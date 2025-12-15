import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { buildFilePath } from "@/lib/hydrus/paths";
import { TagCategory } from "@/generated/prisma/enums";
import { fileLog } from "@/lib/logger";

// Valid filename pattern: {64-char hash}.{extension}
const FILENAME_PATTERN = /^([a-f0-9]{64})(\.\w+)$/i;

function sanitizeFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .slice(0, 30); // Limit length
}

function buildDownloadFilename(
  hash: string,
  extension: string,
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

  return `${parts.join("_")}.${extension}`;
}

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
        include: {
          tag: true,
        },
      },
      groups: {
        include: {
          group: {
            include: {
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

  const downloadFilename = buildDownloadFilename(hash, post.extension, artistTag, characterTag, pageNum);
  const filePath = buildFilePath(hash, post.extension);

  try {
    const stats = statSync(filePath);
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": post.mimeType,
        "Content-Length": String(stats.size),
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
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
