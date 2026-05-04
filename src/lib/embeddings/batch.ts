import pLimit from "p-limit";
import { OpenRouterClient, OpenRouterConfigError } from "@/lib/openrouter";
import { buildFilePath } from "@/lib/hydrus/paths";
import { aiLog } from "@/lib/logger";
import {
  preprocessImageForEmbedding,
  type ProcessedEmbeddingImage,
} from "@/lib/embeddings/image";
import {
  getEmbeddingSettings,
  getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured,
  toEmbeddingConfig,
  type EmbeddingConfig,
  type EmbeddingSettings,
} from "@/lib/embeddings/settings";
import {
  assertVectorExtensionsAvailable,
  countPendingEmbeddings,
  findEmbeddingPostsToProcess,
  getEmbeddingStats,
  upsertCompleteEmbedding,
  upsertFailedEmbedding,
  type EmbeddingPostToProcess,
  type EmbeddingStats,
} from "@/lib/embeddings/store";

export const DEFAULT_EMBEDDING_BATCH_SIZE = 8;
export const MAX_EMBEDDING_BATCH_SIZE = 32;
const PREPROCESS_CONCURRENCY = 2;
const FALLBACK_CONCURRENCY = 2;

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
    batchSize = DEFAULT_EMBEDDING_BATCH_SIZE,
    limit,
    retryFailed = false,
    onProgress,
  } = options;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
  }
  if (batchSize > MAX_EMBEDDING_BATCH_SIZE) {
    throw new RangeError(`batchSize must be ${MAX_EMBEDDING_BATCH_SIZE} or less, got ${batchSize}`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError(`limit must be a non-negative integer, got ${limit}`);
  }

  await assertVectorExtensionsAvailable();

  const settings = await getEmbeddingOpenRouterSettings();
  if (!isEmbeddingProviderConfigured(settings)) {
    throw new OpenRouterConfigError("OpenRouter API key not configured. Set it in Admin Embeddings.");
  }

  const config: EmbeddingConfig = toEmbeddingConfig(settings);

  const totalPending = await countPendingEmbeddings(config, retryFailed);
  const total = limit !== undefined ? Math.min(totalPending, limit) : totalPending;

  const client = new OpenRouterClient({
    apiKey: settings.apiKey ?? "",
    model: settings.model,
    baseUrl: settings.baseUrl,
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

    const results = await computeEmbeddingPostBatch({
      client,
      config,
      posts,
    });

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

async function computeEmbeddingPostBatch(options: {
  client: OpenRouterClient;
  config: EmbeddingConfig;
  posts: EmbeddingPostToProcess[];
}): Promise<boolean[]> {
  const { client, config, posts } = options;
  const prepared: Array<{
    post: EmbeddingPostToProcess;
    processedImage: ProcessedEmbeddingImage;
  }> = [];
  const results = new Map<number, boolean>();

  const preprocessLimit = pLimit(PREPROCESS_CONCURRENCY);
  await Promise.all(posts.map((post) =>
    preprocessLimit(async () => {
      try {
        const filePath = buildFilePath(post.hash, post.extension);
        const processedImage = await preprocessImageForEmbedding(filePath, config.imageMaxResolution);
        prepared.push({ post, processedImage });
      } catch (error) {
        await recordFailedEmbedding({
          post,
          config,
          processedImage: null,
          error,
        });
        results.set(post.id, false);
      }
    })
  ));

  if (prepared.length > 0) {
    try {
      const embeddingResults = await client.createImageEmbeddings({
        model: config.model,
        imageUrls: prepared.map(({ processedImage }) => processedImage.dataUrl),
        dimensions: config.dimensions,
      });

      await Promise.all(prepared.map(async ({ post, processedImage }, index) => {
        const result = embeddingResults[index];
        if (!result) {
          throw new Error("Embedding response did not include every requested input");
        }

        const succeeded = await recordCompleteEmbedding({
          post,
          config,
          processedImage,
          embedding: result.embedding,
        });
        results.set(post.id, succeeded);
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aiLog.warn({ count: prepared.length, error: message }, "Failed to compute batched image embeddings; retrying individually");

      const fallbackLimit = pLimit(FALLBACK_CONCURRENCY);
      const unresolved = prepared.filter(({ post }) => results.get(post.id) !== true);
      await Promise.all(unresolved.map(({ post, processedImage }) =>
        fallbackLimit(async () => {
          const succeeded = await computePreparedImageEmbedding({
            client,
            config,
            post,
            processedImage,
          });
          results.set(post.id, succeeded);
        })
      ));
    }
  }

  return posts.map((post) => results.get(post.id) ?? false);
}

async function computePreparedImageEmbedding(options: {
  client: OpenRouterClient;
  config: EmbeddingConfig;
  post: EmbeddingPostToProcess;
  processedImage: ProcessedEmbeddingImage;
}): Promise<boolean> {
  const { client, config, post, processedImage } = options;

  try {
    const result = await client.createImageEmbedding({
      model: config.model,
      imageUrl: processedImage.dataUrl,
      dimensions: config.dimensions,
    });

    return recordCompleteEmbedding({
      post,
      config,
      processedImage,
      embedding: result.embedding,
    });
  } catch (error) {
    await recordFailedEmbedding({
      post,
      config,
      processedImage,
      error,
    });
    return false;
  }
}

async function recordCompleteEmbedding(options: {
  post: EmbeddingPostToProcess;
  config: EmbeddingConfig;
  processedImage: ProcessedEmbeddingImage;
  embedding: number[];
}): Promise<boolean> {
  const { post, config, processedImage, embedding } = options;

  try {
    await upsertCompleteEmbedding({
      postId: post.id,
      config,
      embedding,
      sourceWidth: processedImage.sourceWidth,
      sourceHeight: processedImage.sourceHeight,
      processedWidth: processedImage.processedWidth,
      processedHeight: processedImage.processedHeight,
    });
    return true;
  } catch (error) {
    await recordFailedEmbedding({
      post,
      config,
      processedImage,
      error,
    });
    return false;
  }
}

async function recordFailedEmbedding(options: {
  post: EmbeddingPostToProcess;
  config: EmbeddingConfig;
  processedImage: ProcessedEmbeddingImage | null;
  error: unknown;
}): Promise<void> {
  const { post, config, processedImage, error } = options;
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
}

export async function getCurrentEmbeddingStats(): Promise<{
  settings: Pick<
    EmbeddingSettings,
    "apiKeyConfigured" | "apiKeyRequired" | "maskedApiKey" | "baseUrl" | "model" | "dimensions" | "imageMaxResolution"
  >;
  stats: EmbeddingStats;
}> {
  const settings = await getEmbeddingSettings();
  const stats = await getEmbeddingStats(toEmbeddingConfig(settings));

  return {
    settings: {
      apiKeyConfigured: settings.apiKeyConfigured,
      apiKeyRequired: settings.apiKeyRequired,
      maskedApiKey: settings.maskedApiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      dimensions: settings.dimensions,
      imageMaxResolution: settings.imageMaxResolution,
    },
    stats,
  };
}
