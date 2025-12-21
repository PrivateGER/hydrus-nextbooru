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
import { extractVideoFrame, isFfmpegAvailable, generateAnimatedPreview } from "./video-extractor";
import { buildFilePath } from "@/lib/hydrus/paths";
import { thumbnailLog } from "@/lib/logger";
import { ANIMATED_PREVIEW_CONFIG } from "./types";

// Cache ffmpeg availability check
let ffmpegAvailable: boolean | null = null;

/**
 * Image formats that Sharp v0.34+ natively supports without third-party adapters.
 * Supported: JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG
 * Note: SVG support requires librsvg system dependency in the deployment environment.
 * Excluded: PSD, RAW, HEIC, BMP, ICO, APNG (require additional plugins/adapters)
 */
const SHARP_SUPPORTED_IMAGES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/svg+xml",
]);

/**
 * Check if a mime type can have thumbnails generated.
 * Videos are supported via ffmpeg, images must be in Sharp's supported list.
 */
function canGenerateThumbnail(mimeType: string): boolean {
  if (mimeType.startsWith("video/")) return true;
  return SHARP_SUPPORTED_IMAGES.has(mimeType);
}

/**
 * Check if a mime type is a media type (for determining if Hydrus fallback applies).
 */
function isMediaType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

async function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable === null) {
    ffmpegAvailable = await isFfmpegAvailable();
    if (!ffmpegAvailable) {
      thumbnailLog.warn({}, 'ffmpeg not available - video thumbnails will use Hydrus fallback');
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
      error: `Not a media type: ${post.mimeType}`,
    };
  }

  // Skip image formats that Sharp can't process (e.g., PSD, RAW)
  // These will use Hydrus fallback thumbnails
  if (!canGenerateThumbnail(post.mimeType)) {
    // Mark as unsupported so we don't retry
    await prisma.post.update({
      where: { id: post.id },
      data: { thumbnailStatus: ThumbnailStatus.UNSUPPORTED },
    });

    return {
      success: false,
      fallback: "hydrus",
      error: `Image format not supported by Sharp: ${post.mimeType}`,
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
        thumbnailLog.error({ hash: post.hash, error: err instanceof Error ? err.message : String(err) }, 'Failed to extract video frame');
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

    thumbnailLog.debug({ hash: post.hash, size, width: result.width, height: result.height, fileSize: fileStats.size }, 'Thumbnail generated');

    return {
      success: true,
      path: outputPath,
      width: result.width,
      height: result.height,
      fileSize: fileStats.size,
    };
  } catch (err) {
    thumbnailLog.error({ hash: post.hash, error: err instanceof Error ? err.message : String(err) }, 'Thumbnail generation failed');

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

/**
 * Check if a post can have an animated preview generated.
 * Only videos and animated images (GIF, APNG) are eligible.
 */
export function canGenerateAnimatedPreview(post: PostForThumbnail): boolean {
  const isVideo = post.mimeType.startsWith("video/");
  const isAnimatedImage = post.mimeType === "image/gif" || post.mimeType === "image/apng";

  if (!isVideo && !isAnimatedImage) return false;

  // Need duration to determine if long enough
  if (!post.duration) return false;

  const minDuration = isVideo
    ? ANIMATED_PREVIEW_CONFIG.minVideoDuration
    : ANIMATED_PREVIEW_CONFIG.minGifDuration;

  return post.duration >= minDuration;
}

/**
 * Generate an animated preview thumbnail for a video or GIF.
 */
export async function generateAnimatedThumbnail(
  post: PostForThumbnail
): Promise<ThumbnailResult> {
  // Verify this post is eligible for animated preview
  if (!canGenerateAnimatedPreview(post)) {
    return {
      success: false,
      error: "Post is not eligible for animated preview",
    };
  }

  // Check ffmpeg availability (required for all animated previews)
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    return {
      success: false,
      error: "ffmpeg not available for animated preview generation",
    };
  }

  const outputPath = getThumbnailPath(post.hash, ThumbnailSize.ANIMATED);
  const relativePath = getThumbnailRelativePath(post.hash, ThumbnailSize.ANIMATED);
  const filePath = buildFilePath(post.hash, post.extension);
  const isGif = post.mimeType === "image/gif" || post.mimeType === "image/apng";

  try {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Generate animated preview
    await generateAnimatedPreview(filePath, outputPath, {
      durationMs: post.duration!,
      isGif,
    });

    // Get file stats
    const fileStats = await stat(outputPath);

    // Save to database
    await prisma.thumbnail.upsert({
      where: {
        postId_size: { postId: post.id, size: ThumbnailSize.ANIMATED },
      },
      create: {
        postId: post.id,
        size: ThumbnailSize.ANIMATED,
        format: "webp",
        width: THUMBNAIL_DIMENSIONS.ANIMATED,
        height: 0, // Animated previews don't track exact height
        fileSize: fileStats.size,
        path: relativePath,
      },
      update: {
        format: "webp",
        width: THUMBNAIL_DIMENSIONS.ANIMATED,
        height: 0,
        fileSize: fileStats.size,
        path: relativePath,
        generatedAt: new Date(),
      },
    });

    thumbnailLog.debug({ hash: post.hash, fileSize: fileStats.size }, 'Animated preview generated');

    return {
      success: true,
      path: outputPath,
      width: THUMBNAIL_DIMENSIONS.ANIMATED,
      fileSize: fileStats.size,
    };
  } catch (err) {
    thumbnailLog.error({ hash: post.hash, error: err instanceof Error ? err.message : String(err) }, 'Animated preview generation failed');

    return {
      success: false,
      error: String(err),
    };
  }
}
