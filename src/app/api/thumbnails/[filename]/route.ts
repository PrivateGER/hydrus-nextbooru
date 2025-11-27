import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync, existsSync } from "fs";
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
 * Serve a file with streaming and cache headers.
 */
function serveFile(
  filePath: string,
  contentType: string,
  source: "generated" | "hydrus"
): NextResponse {
  const stats = statSync(filePath);
  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Cache-Control": "public, max-age=31536000, immutable",
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

  // Check for existing generated thumbnail
  if (post.thumbnails.length > 0) {
    const thumbnailPath = join(getThumbnailBasePath(), post.thumbnails[0].path);
    if (existsSync(thumbnailPath)) {
      try {
        return serveFile(thumbnailPath, "image/webp", "generated");
      } catch (err) {
        console.error(`Error serving generated thumbnail ${hash}:`, err);
        // Fall through to Hydrus fallback
      }
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

  // Serve Hydrus fallback
  const hydrusThumbnailPath = getHydrusThumbnailPath(hash);

  if (!existsSync(hydrusThumbnailPath)) {
    return NextResponse.json(
      { error: "Thumbnail not found on disk" },
      { status: 404 }
    );
  }

  try {
    return serveFile(hydrusThumbnailPath, "image/jpeg", "hydrus");
  } catch (err) {
    console.error(`Error serving Hydrus thumbnail ${hash}:`, err);

    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "Thumbnail not found on disk" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
