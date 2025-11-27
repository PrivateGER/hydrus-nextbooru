import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { buildFilePath } from "@/lib/hydrus/paths";

// Valid filename pattern: {64-char hash}.{extension}
const FILENAME_PATTERN = /^([a-f0-9]{64})(\.\w+)$/i;

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

  // Look up the post in the database
  const post = await prisma.post.findUnique({
    where: { hash },
    select: {
      extension: true,
      mimeType: true,
      fileSize: true,
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

  // Build file path from hash and extension
  const filePath = buildFilePath(hash, post.extension);

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
