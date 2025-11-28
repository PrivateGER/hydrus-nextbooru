import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { buildFilePath } from "@/lib/hydrus/paths";

// Extension to MIME type mapping (skip database lookup)
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".flv": "video/x-flv",
  ".wmv": "video/x-ms-wmv",
  ".m4v": "video/x-m4v",
  ".apng": "image/apng",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
};

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
  const extension = match[2].toLowerCase(); // includes the dot

  // Get MIME type from extension (skip database lookup)
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) {
    return NextResponse.json(
      { error: `Unsupported file extension: ${extension}` },
      { status: 400 }
    );
  }

  // Build file path from hash and extension
  const filePath = buildFilePath(hash, extension);

  try {
    // Get file stats (async)
    const stats = await stat(filePath);

    // ETag based on hash (immutable content-addressed files)
    const etag = `"${hash}"`;

    // Check If-None-Match for 304 response
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

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
          "Content-Type": mimeType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "ETag": etag,
        },
      });
    }

    // Full file response
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stats.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    console.error(`Error serving file ${hash}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
