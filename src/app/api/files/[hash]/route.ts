import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { join } from "path";
import { prisma } from "@/lib/db";

// Valid SHA256 hash pattern
const HASH_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Build file path from hash using Hydrus folder structure:
 * f[first two chars of hash]/[hash].[ext]
 */
function buildFilePath(hash: string, extension: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return join(basePath, `f${prefix}`, `${hash}${extension}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;

  // Validate hash format
  if (!HASH_PATTERN.test(hash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }

  // Look up the post in the database
  const post = await prisma.post.findUnique({
    where: { hash: hash.toLowerCase() },
    select: {
      extension: true,
      mimeType: true,
      fileSize: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Build file path from hash and extension
  const filePath = buildFilePath(hash.toLowerCase(), post.extension);

  try {
    // Get file stats
    const stats = statSync(filePath);

    // Handle range requests for video streaming
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": post.mimeType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Full file response
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": post.mimeType,
        "Content-Length": String(stats.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(`Error serving file ${hash}:`, err);

    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
