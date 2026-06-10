import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { buildFilePath } from "@/lib/hydrus/paths";
import { TagCategory } from "@/generated/prisma/enums";
import { fileLog } from "@/lib/logger";

// Valid filename pattern: {64-char hash}.{extension}
const FILENAME_PATTERN = /^([a-f0-9]{64})(\.\w+)$/i;

// A trustworthy file extension: leading dot + 1-10 word chars (alphanumeric/_).
// Anything else (header-injection payloads, CRLF, quotes, overlong strings) is
// rejected so it cannot reach the Content-Disposition response header.
const SAFE_EXTENSION_PATTERN = /^\.\w{1,10}$/;

/**
 * Return the stored extension only if it is a short, well-formed `.ext` token;
 * otherwise fall back to `.bin` so a malformed/hostile DB value can never be
 * interpolated into a response header or download filename.
 */
export function safeExtension(extension: string | null | undefined): string {
  return extension && SAFE_EXTENSION_PATTERN.test(extension) ? extension : ".bin";
}

function sanitizeFilename(str: string): string {
  return str
    .replace(/[\x00-\x1f\x7f]/g, "") // Strip C0 control chars + DEL (header-safety; CRLF is also caught by \s below, but other control bytes would reach the header and trip Node's validator)
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, "_") // Replace spaces (and any remaining whitespace) with underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .slice(0, 30); // Limit length
}

function buildDownloadFilename(
  hash: string,
  safeExt: string,
  artistTag?: string,
  characterTag?: string,
  pageNum?: number
): string {
  const parts: string[] = [];

  if (artistTag) {
    parts.push(sanitizeFilename(artistTag));
  }

  if (characterTag) {
    parts.push(sanitizeFilename(characterTag));
  }

  parts.push(hash.slice(0, 8));

  if (pageNum !== undefined) {
    parts.push(`p${pageNum}`);
  }

  // safeExt already includes its leading dot and has been validated by
  // safeExtension(), so it is appended directly (not re-prefixed with ".").
  return `${parts.join("_")}${safeExt}`;
}

/**
 * Serve a stored file identified by the route filename (hash and extension) and stream it to the client with download headers.
 *
 * @param params - Route parameters; `params.filename` must be in the format `{64-hex-hash}.{extension}` (case-insensitive).
 * @returns A NextResponse that on success contains the file stream with `Content-Type`, `Content-Length`, `Content-Disposition` (attachment with a generated filename), and caching headers; on failure returns a JSON error response with an appropriate HTTP status (400 for invalid requests or extension mismatch, 404 if the file or database record is not found, 500 for other server errors).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Parse and validate filename
  const match = FILENAME_PATTERN.exec(filename);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid filename format. Expected {hash}.{extension}" },
      { status: 400 }
    );
  }

  const hash = match[1].toLowerCase();
  const requestedExt = match[2].toLowerCase(); // includes the dot

  const post = await prisma.post.findUnique({
    where: { hash },
    select: {
      extension: true,
      mimeType: true,
      fileSize: true,
      tags: {
        where: {
          tag: {
            category: {
              in: [TagCategory.ARTIST, TagCategory.CHARACTER],
            },
          },
        },
        select: {
          tag: {
            select: {
              name: true,
              category: true,
            },
          },
        },
      },
      groups: {
        select: {
          position: true,
          group: {
            select: {
              _count: { select: { posts: true } },
            },
          },
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Validate extension matches (both include the dot)
  if (requestedExt !== post.extension.toLowerCase()) {
    return NextResponse.json(
      { error: "Extension mismatch" },
      { status: 400 }
    );
  }

  // Find tags by category
  // Prefer artist tags that aren't purely numeric (IDs)
  const artistTags = post.tags.filter((t) => t.tag.category === TagCategory.ARTIST);
  const artistTag =
    artistTags.find((t) => !/^\d+$/.test(t.tag.name))?.tag.name ||
    artistTags[0]?.tag.name;

  // Get first character tag
  const characterTag = post.tags.find((t) => t.tag.category === TagCategory.CHARACTER)?.tag.name;

  // Get page number from first multi-post group
  const groupWithPosition = post.groups.find((g) => g.group._count.posts > 1);
  const pageNum = groupWithPosition?.position;

  // Validate the DB-stored extension before it reaches the Content-Disposition
  // header. The on-disk path still uses the raw post.extension (the extension
  // mismatch check above already proved it equals the validated requestedExt).
  const downloadExt = safeExtension(post.extension);
  const downloadFilename = buildDownloadFilename(hash, downloadExt, artistTag, characterTag, pageNum);
  const filePath = buildFilePath(hash, post.extension);

  try {
    const stats = await stat(filePath);
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": post.mimeType,
        "Content-Length": String(stats.size),
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    fileLog.error({ hash, error: err instanceof Error ? err.message : String(err) }, 'Error serving download');

    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
