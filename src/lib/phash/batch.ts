import pLimit from "p-limit";
import { availableParallelism } from "os";
import { prisma } from "@/lib/db";
import { computePhash, PHASH_SUPPORTED_MIMES } from "@/lib/phash/compute";
import { buildFilePath } from "@/lib/hydrus/paths";
import { phashLog } from "@/lib/logger";

// Use half of available CPUs, minimum 2
const computeLimit = pLimit(Math.max(2, Math.floor(availableParallelism() / 2)));

/**
 * Batch compute phashes for posts that don't have one yet.
 */
export async function batchComputePhashes(options: {
  batchSize?: number;
  limit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  const { batchSize = 50, limit, onProgress } = options;

  if (!Number.isFinite(batchSize) || !Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
  }
  if (limit !== undefined && (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 0)) {
    throw new RangeError(`limit must be a non-negative integer, got ${limit}`);
  }

  // Count total pending for progress reporting
  const pendingWhere: { phashEntry: null; mimeType: { in: string[] } } = {
    phashEntry: null,
    mimeType: { in: [...PHASH_SUPPORTED_MIMES] },
  };
  const totalPending = await prisma.post.count({ where: pendingWhere });
  const total = limit !== undefined ? Math.min(totalPending, limit) : totalPending;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let lastId: number | undefined;

  // Page through results with cursor-based pagination to avoid loading all rows into memory
  while (processed < total) {
    const pageSize = Math.min(batchSize, total - processed);
    const posts = await prisma.post.findMany({
      where: {
        ...pendingWhere,
        ...(lastId !== undefined ? { id: { gt: lastId } } : {}),
      },
      select: { id: true, hash: true, extension: true, mimeType: true },
      take: pageSize,
      orderBy: { id: "asc" },
    });

    if (posts.length === 0) break;

    const results = await Promise.all(
      posts.map((post) =>
        computeLimit(async () => {
          const filePath = buildFilePath(post.hash, post.extension);
          const phash = await computePhash(filePath);

          if (phash !== null) {
            await prisma.phashEntry.upsert({
              where: { hash: post.hash },
              create: { hash: post.hash, phash },
              update: { phash, computedAt: new Date() },
            });
            return true;
          }

          phashLog.warn({ hash: post.hash, mimeType: post.mimeType }, "Failed to compute phash");
          return false;
        })
      )
    );

    for (const success of results) {
      processed++;
      if (success) succeeded++;
      else failed++;
    }

    lastId = posts[posts.length - 1].id;
    onProgress?.(processed, total);
  }

  return { processed, succeeded, failed };
}

/**
 * Get phash computation statistics.
 */
export async function getPhashStats(): Promise<{
  total: number;
  withPhash: number;
  withoutPhash: number;
  unsupported: number;
}> {
  const [total, withPhash, supportedWithout] = await Promise.all([
    prisma.post.count(),
    prisma.phashEntry.count(),
    prisma.post.count({
      where: {
        phashEntry: null,
        mimeType: { in: [...PHASH_SUPPORTED_MIMES] },
      },
    }),
  ]);

  return {
    total,
    withPhash,
    withoutPhash: supportedWithout,
    unsupported: total - withPhash - supportedWithout,
  };
}
