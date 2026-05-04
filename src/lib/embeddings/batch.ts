import pLimit from "p-limit";
import { OpenRouterClient, OpenRouterConfigError } from "@/lib/openrouter";
import { buildFilePath } from "@/lib/hydrus/paths";
import { aiLog } from "@/lib/logger";
import { preprocessImageForEmbedding } from "@/lib/embeddings/image";
import {
  getEmbeddingOpenRouterSettings,
  type EmbeddingConfig,
} from "@/lib/embeddings/settings";
import {
  assertVectorExtensionsAvailable,
  countPendingEmbeddings,
  findEmbeddingPostsToProcess,
  getEmbeddingStats,
  upsertCompleteEmbedding,
  upsertFailedEmbedding,
  type EmbeddingStats,
} from "@/lib/embeddings/store";

const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_CONCURRENCY = 2;
const apiLimit = pLimit(DEFAULT_CONCURRENCY);

export interface BatchEmbeddingOptions {
  batchSize?: number;
  limit?: number;
  retryFailed?: boolean;
  onProgress?: (processed: number, total: number) => void;
}

export interface BatchEmbeddingResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function batchComputeImageEmbeddings(
  options: BatchEmbeddingOptions = {}
): Promise<BatchEmbeddingResult> {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    limit,
    retryFailed = false,
    onProgress,
  } = options;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError(`limit must be a non-negative integer, got ${limit}`);
  }

  await assertVectorExtensionsAvailable();

  const settings = await getEmbeddingOpenRouterSettings();
  if (!settings.apiKey) {
    throw new OpenRouterConfigError("OpenRouter API key not configured. Set it in Admin Embeddings.");
  }

  const config: EmbeddingConfig = {
    model: settings.model,
    dimensions: settings.dimensions,
    imageMaxResolution: settings.imageMaxResolution,
  };

  const totalPending = await countPendingEmbeddings(config, retryFailed);
  const total = limit !== undefined ? Math.min(totalPending, limit) : totalPending;

  const client = new OpenRouterClient({
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl || undefined,
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let lastId: number | undefined;

  while (processed < total) {
    const take = Math.min(batchSize, total - processed);
    const posts = await findEmbeddingPostsToProcess({
      config,
      retryFailed,
      lastId,
      take,
    });

    if (posts.length === 0) break;

    const results = await Promise.all(
      posts.map((post) =>
        apiLimit(async () => {
          let processedImage: Awaited<ReturnType<typeof preprocessImageForEmbedding>> | null = null;

          try {
            const filePath = buildFilePath(post.hash, post.extension);
            processedImage = await preprocessImageForEmbedding(filePath, config.imageMaxResolution);
            const result = await client.createImageEmbedding({
              model: config.model,
              imageUrl: processedImage.dataUrl,
              dimensions: config.dimensions,
            });

            await upsertCompleteEmbedding({
              postId: post.id,
              config,
              embedding: result.embedding,
              sourceWidth: processedImage.sourceWidth,
              sourceHeight: processedImage.sourceHeight,
              processedWidth: processedImage.processedWidth,
              processedHeight: processedImage.processedHeight,
            });

            return true;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            aiLog.warn({ hash: post.hash, error: message }, "Failed to compute image embedding");
            await upsertFailedEmbedding({
              postId: post.id,
              config,
              errorMessage: message,
              sourceWidth: processedImage?.sourceWidth ?? post.width,
              sourceHeight: processedImage?.sourceHeight ?? post.height,
              processedWidth: processedImage?.processedWidth ?? null,
              processedHeight: processedImage?.processedHeight ?? null,
            });
            return false;
          }
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

export async function getCurrentEmbeddingStats(): Promise<{
  settings: Awaited<ReturnType<typeof getEmbeddingOpenRouterSettings>>;
  stats: EmbeddingStats;
}> {
  const settings = await getEmbeddingOpenRouterSettings();
  const stats = await getEmbeddingStats({
    model: settings.model,
    dimensions: settings.dimensions,
    imageMaxResolution: settings.imageMaxResolution,
  });

  return { settings, stats };
}
