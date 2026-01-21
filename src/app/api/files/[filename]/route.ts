import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { buildFilePath } from "@/lib/hydrus/paths";
import { fileLog } from "@/lib/logger";

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
      let start: number;
      let end: number;

      // Handle suffix range (e.g., "bytes=-1000" means last 1000 bytes)
      if (parts[0] === "") {
        const suffixLength = parseInt(parts[1], 10);
        if (Number.isNaN(suffixLength) || suffixLength <= 0) {
          return new NextResponse(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              "Content-Range": `bytes */${stats.size}`,
            },
          });
        }
        start = Math.max(stats.size - suffixLength, 0);
        end = stats.size - 1;
      } else {
        // Standard range (e.g., "bytes=0-1023" or "bytes=500-")
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        // Validate range bounds
        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start < 0 ||
          start > end ||
          start >= stats.size
        ) {
          return new NextResponse(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              "Content-Range": `bytes */${stats.size}`,
            },
          });
        }
      }

      // Clamp end to file size (browsers may request beyond file size)
      const clampedEnd = Math.min(end, stats.size - 1);
      const chunkSize = clampedEnd - start + 1;

      const stream = createReadStream(filePath, { start, end: clampedEnd });
      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${clampedEnd}/${stats.size}`,
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

    fileLog.error({ hash, error: err instanceof Error ? err.message : String(err) }, 'Error serving file');
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
