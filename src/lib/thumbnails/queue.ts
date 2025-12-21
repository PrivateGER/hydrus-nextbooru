import pLimit from "p-limit";
import { prisma } from "@/lib/db";
import { ThumbnailSize, ThumbnailStatus, PostForThumbnail } from "./types";
import { generateThumbnail, generateAllThumbnails, generateAnimatedThumbnail, canGenerateAnimatedPreview } from "./generator";
import { thumbnailLog } from "@/lib/logger";

// Limit concurrent thumbnail generations to avoid memory issues
const generationLimit = pLimit(4);

// Track in-flight generations to prevent duplicates
const pendingGenerations = new Map<string, Promise<void>>();

/**
 * Ensure a thumbnail exists for the given hash and size.
 * Uses request coalescing to prevent duplicate generation.
 */
export async function ensureThumbnail(
  hash: string,
  size: ThumbnailSize
): Promise<void> {
  const key = `${hash}:${size}`;

  // Return existing promise if already generating
  const existing = pendingGenerations.get(key);
  if (existing) {
    return existing;
  }

  const promise = generationLimit(async () => {
    try {
      // Get post data with existing thumbnails
      const post = await prisma.post.findUnique({
        where: { hash: hash.toLowerCase() },
        select: {
          id: true,
          hash: true,
          extension: true,
          mimeType: true,
          thumbnailStatus: true,
          duration: true,
          thumbnails: {
            where: { size },
            select: { id: true },
          },
        },
      });

      if (!post) {
        thumbnailLog.warn({ hash }, 'Post not found for thumbnail generation');
        return;
      }

      // Skip if this specific size already exists
      if (post.thumbnails.length > 0) {
        return;
      }

      // Skip if marked as failed or unsupported (requires manual reset)
      if (
        post.thumbnailStatus === ThumbnailStatus.FAILED ||
        post.thumbnailStatus === ThumbnailStatus.UNSUPPORTED
      ) {
        return;
      }

      // Skip non-media files
      if (
        !post.mimeType.startsWith("image/") &&
        !post.mimeType.startsWith("video/")
      ) {
        return;
      }

      // Handle animated thumbnails separately
      if (size === ThumbnailSize.ANIMATED) {
        const canGenerate = canGenerateAnimatedPreview(post as PostForThumbnail);
        thumbnailLog.debug({ hash, mimeType: post.mimeType, duration: post.duration, canGenerate }, 'Checking animated preview eligibility');
        if (canGenerate) {
          thumbnailLog.info({ hash }, 'Generating animated preview');
          await generateAnimatedThumbnail(post as PostForThumbnail);
        }
        return;
      }

      await generateThumbnail(post as PostForThumbnail, size);
    } catch (err) {
      thumbnailLog.error({ hash, error: err instanceof Error ? err.message : String(err) }, 'Error in ensureThumbnail');
    }
  });

  pendingGenerations.set(key, promise);

  try {
    await promise;
  } finally {
    pendingGenerations.delete(key);
  }
}

/**
 * Queue generation of all thumbnail sizes for a post.
 * Non-blocking - returns immediately.
 */
export function queueThumbnailGeneration(hash: string): void {
  // Fire and forget - errors are logged internally
  ensureThumbnail(hash, ThumbnailSize.GRID).catch(() => {});
  ensureThumbnail(hash, ThumbnailSize.PREVIEW).catch(() => {});
  ensureThumbnail(hash, ThumbnailSize.ANIMATED).catch(() => {});
}

/**
 * Batch generate thumbnails for posts that need them.
 * Useful for background processing or admin triggers.
 */
export async function batchGenerateThumbnails(options: {
  batchSize?: number;
  limit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  const { batchSize = 50, limit, onProgress } = options;

  // Get posts that need thumbnail generation (only media files)
  const pendingPosts = await prisma.post.findMany({
    where: {
      thumbnailStatus: {
        in: [ThumbnailStatus.PENDING],
      },
      OR: [
        { mimeType: { startsWith: "image/" } },
        { mimeType: { startsWith: "video/" } },
      ],
    },
    select: {
      id: true,
      hash: true,
      extension: true,
      mimeType: true,
      thumbnailStatus: true,
      duration: true,
    },
    take: limit,
    orderBy: { id: "asc" },
  });

  const total = pendingPosts.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < pendingPosts.length; i += batchSize) {
    const batch = pendingPosts.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map((post) =>
        generationLimit(async () => {
          const result = await generateAllThumbnails(post as PostForThumbnail);
          return result.grid.success && result.preview.success;
        })
      )
    );

    for (const success of results) {
      processed++;
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    onProgress?.(processed, total);
  }

  return { processed, succeeded, failed };
}

/**
 * Get current thumbnail generation statistics.
 */
export async function getThumbnailStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  unsupported: number;
}> {
  const [total, pending, processing, complete, failed, unsupported] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { thumbnailStatus: ThumbnailStatus.PENDING } }),
    prisma.post.count({
      where: { thumbnailStatus: ThumbnailStatus.PROCESSING },
    }),
    prisma.post.count({ where: { thumbnailStatus: ThumbnailStatus.COMPLETE } }),
    prisma.post.count({ where: { thumbnailStatus: ThumbnailStatus.FAILED } }),
    prisma.post.count({ where: { thumbnailStatus: ThumbnailStatus.UNSUPPORTED } }),
  ]);

  return { total, pending, processing, complete, failed, unsupported };
}
