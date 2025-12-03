import sharp from "sharp";
import { mkdir, stat } from "fs/promises";
import { dirname } from "path";
import { prisma } from "@/lib/db";
import {
  ThumbnailSize,
  ThumbnailStatus,
  THUMBNAIL_DIMENSIONS,
  ThumbnailResult,
  PostForThumbnail,
} from "./types";
import { getThumbnailPath, getThumbnailRelativePath } from "./paths";
import { extractVideoFrame, isFfmpegAvailable } from "./video-extractor";
import { buildFilePath } from "@/lib/hydrus/paths";

// Cache ffmpeg availability check
let ffmpegAvailable: boolean | null = null;

/**
 * Check if a mime type is a media type that can have thumbnails generated.
 */
function isMediaType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

async function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable === null) {
    ffmpegAvailable = await isFfmpegAvailable();
    if (!ffmpegAvailable) {
      console.warn(
        "ffmpeg not available - video thumbnails will use Hydrus fallback"
      );
    }
  }
  return ffmpegAvailable;
}

/**
 * Generate a thumbnail for a post at the specified size.
 */
export async function generateThumbnail(
  post: PostForThumbnail,
  size: ThumbnailSize
): Promise<ThumbnailResult> {
  // Skip non-media files (text, documents, etc.)
  if (!isMediaType(post.mimeType)) {
    return {
      success: false,
      fallback: "hydrus",
      error: `Unsupported media type: ${post.mimeType}`,
    };
  }

  const isVideo = post.mimeType.startsWith("video/");
  const outputPath = getThumbnailPath(post.hash, size);
  const relativePath = getThumbnailRelativePath(post.hash, size);
  const maxDimension = THUMBNAIL_DIMENSIONS[size];
  const filePath = buildFilePath(post.hash, post.extension);

  try {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    let inputSource: string | Buffer;

    if (isVideo) {
      // Check ffmpeg availability
      const hasFfmpeg = await checkFfmpeg();
      if (!hasFfmpeg) {
        return {
          success: false,
          fallback: "hydrus",
          error: "ffmpeg not available for video thumbnail",
        };
      }

      // Extract frame from video
      try {
        inputSource = await extractVideoFrame(filePath);
      } catch (err) {
        console.error(
          `Failed to extract video frame for ${post.hash}:`,
          err
        );
        return {
          success: false,
          fallback: "hydrus",
          error: `Video frame extraction failed: ${err}`,
        };
      }
    } else {
      inputSource = filePath;
    }

    // Process with Sharp
    const result = await sharp(inputSource, {
      limitInputPixels: 268402689, // ~16384x16384
      sequentialRead: true,
    })
      .resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toFile(outputPath);

    // Get file size
    const fileStats = await stat(outputPath);

    // Save to database
    await prisma.thumbnail.upsert({
      where: {
        postId_size: { postId: post.id, size },
      },
      create: {
        postId: post.id,
        size,
        format: "webp",
        width: result.width,
        height: result.height,
        fileSize: fileStats.size,
        path: relativePath,
      },
      update: {
        format: "webp",
        width: result.width,
        height: result.height,
        fileSize: fileStats.size,
        path: relativePath,
        generatedAt: new Date(),
      },
    });

    // Update post status based on how many thumbnails now exist
    const thumbnailCount = await prisma.thumbnail.count({
      where: { postId: post.id },
    });

    // Mark complete if both sizes exist, otherwise processing
    await prisma.post.update({
      where: { id: post.id },
      data: {
        thumbnailStatus:
          thumbnailCount >= 2
            ? ThumbnailStatus.COMPLETE
            : ThumbnailStatus.PROCESSING,
      },
    });

    return {
      success: true,
      path: outputPath,
      width: result.width,
      height: result.height,
      fileSize: fileStats.size,
    };
  } catch (err) {
    console.error(`Thumbnail generation failed for ${post.hash}:`, err);

    // Mark as failed in database
    await prisma.post.update({
      where: { id: post.id },
      data: { thumbnailStatus: ThumbnailStatus.FAILED },
    });

    return {
      success: false,
      fallback: "hydrus",
      error: String(err),
    };
  }
}

/**
 * Generate all thumbnail sizes for a post.
 */
export async function generateAllThumbnails(
  post: PostForThumbnail
): Promise<{ grid: ThumbnailResult; preview: ThumbnailResult }> {
  // Mark as processing
  await prisma.post.update({
    where: { id: post.id },
    data: { thumbnailStatus: ThumbnailStatus.PROCESSING },
  });

  const gridResult = await generateThumbnail(post, ThumbnailSize.GRID);
  const previewResult = await generateThumbnail(post, ThumbnailSize.PREVIEW);

  // Update final status
  const allSuccessful = gridResult.success && previewResult.success;
  const anySuccessful = gridResult.success || previewResult.success;

  await prisma.post.update({
    where: { id: post.id },
    data: {
      thumbnailStatus: allSuccessful
        ? ThumbnailStatus.COMPLETE
        : anySuccessful
          ? ThumbnailStatus.PROCESSING // Partial success, can retry
          : ThumbnailStatus.FAILED,
    },
  });

  return { grid: gridResult, preview: previewResult };
}
