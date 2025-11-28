import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { join } from "path";
import { prisma } from "@/lib/db";
import {
  ThumbnailSize,
  ThumbnailStatus,
  getThumbnailBasePath,
  getHydrusThumbnailPath,
  queueThumbnailGeneration,
} from "@/lib/thumbnails";

// Valid filename pattern: {64-char hash}.webp
const FILENAME_PATTERN = /^([a-f0-9]{64})\.webp$/i;

// Valid thumbnail size values
const VALID_SIZES = ["grid", "preview"] as const;
type SizeParam = (typeof VALID_SIZES)[number];

function sizeParamToEnum(size: SizeParam): ThumbnailSize {
  return size === "grid" ? ThumbnailSize.GRID : ThumbnailSize.PREVIEW;
}

/**
 * Serve a file with streaming and cache headers (async).
 */
async function serveFile(
  filePath: string,
  contentType: string,
  hash: string,
  source: "generated" | "hydrus",
  request: NextRequest
): Promise<NextResponse> {
  const stats = await stat(filePath);

  // ETag based on hash (immutable content-addressed files)
  const etag = `"${hash}-${source}"`;

  // Check If-None-Match for 304 response
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": etag,
      "X-Thumbnail-Source": source,
    },
  });
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
      { error: "Invalid filename format. Expected {hash}.webp" },
      { status: 400 }
    );
  }

  const hash = match[1].toLowerCase();

  // Parse size parameter (default: grid)
  const sizeParam = request.nextUrl.searchParams.get("size") || "grid";
  if (!VALID_SIZES.includes(sizeParam as SizeParam)) {
    return NextResponse.json(
      { error: "Invalid size parameter. Use 'grid' or 'preview'" },
      { status: 400 }
    );
  }
  const size = sizeParamToEnum(sizeParam as SizeParam);

  // Get post with thumbnail info
  const post = await prisma.post.findUnique({
    where: { hash },
    select: {
      id: true,
      thumbnailStatus: true,
      thumbnails: {
        where: { size },
        select: { path: true },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Try generated thumbnail first (async, no existsSync)
  if (post.thumbnails.length > 0) {
    const thumbnailPath = join(getThumbnailBasePath(), post.thumbnails[0].path);
    try {
      return await serveFile(thumbnailPath, "image/webp", hash, "generated", request);
    } catch {
      // Fall through to Hydrus fallback
    }
  }

  // Queue thumbnail generation if not already complete/failed
  if (
    post.thumbnailStatus === ThumbnailStatus.PENDING ||
    post.thumbnailStatus === ThumbnailStatus.PROCESSING
  ) {
    // Fire and forget - generation happens in background
    queueThumbnailGeneration(hash);
  }

  // Try Hydrus fallback (async, no existsSync)
  const hydrusThumbnailPath = getHydrusThumbnailPath(hash);

  try {
    return await serveFile(hydrusThumbnailPath, "image/jpeg", hash, "hydrus", request);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "Thumbnail not found" },
        { status: 404 }
      );
    }

    console.error(`Error serving thumbnail ${hash}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
