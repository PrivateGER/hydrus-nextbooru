import pLimit from "p-limit";
import { availableParallelism } from "os";
import { prisma } from "@/lib/db";
import { computePhash, PHASH_SUPPORTED_MIMES } from "./compute";
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

  // Query posts without a PhashEntry that have supported image MIME types
  const pendingPosts = await prisma.post.findMany({
    where: {
      phashEntry: null,
      mimeType: { in: [...PHASH_SUPPORTED_MIMES] },
    },
    select: {
      hash: true,
      extension: true,
      mimeType: true,
    },
    take: limit,
    orderBy: { id: "asc" },
  });

  const total = pendingPosts.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < pendingPosts.length; i += batchSize) {
    const batch = pendingPosts.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map((post) =>
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
