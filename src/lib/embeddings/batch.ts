import pLimit from "p-limit";
import { OpenRouterClient, OpenRouterConfigError } from "@/lib/openrouter";
import type { EmbeddingMediaInput } from "@/lib/openrouter/types";
import { buildFilePath } from "@/lib/hydrus/paths";
import { aiLog } from "@/lib/logger";
import { preprocessImageForEmbedding } from "@/lib/embeddings/image";
import { isVideoToolingAvailable, preprocessVideoForEmbedding } from "@/lib/embeddings/video";
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
/**
 * Upper bound on data-URL bytes per embeddings request. OpenRouter rejects
 * bodies over 50 MiB; JSON framing is negligible next to the base64 payload.
 */
export const MAX_EMBEDDING_REQUEST_BYTES = 40 * 1024 * 1024;
const PREPROCESS_CONCURRENCY = 2;
const FALLBACK_CONCURRENCY = 2;

/** Preprocessed media plus the metadata persisted on the `PostEmbedding` row. */
interface PreparedMedia {
  input: EmbeddingMediaInput;
  sourceWidth: number | null;
  sourceHeight: number | null;
  processedWidth: number;
  processedHeight: number;
}

export interface BatchEmbeddingOptions {
  batchSize?: number;
  limit?: number;
  retryFailed?: boolean;
  onProgress?: (processed: number, total: number) => void;
  /** Data-URL bytes per embeddings request; test seam, defaults to {@link MAX_EMBEDDING_REQUEST_BYTES}. */
  maxRequestBytes?: number;
}

export interface BatchEmbeddingResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function batchComputeEmbeddings(
  options: BatchEmbeddingOptions = {}
): Promise<BatchEmbeddingResult> {
  const {
    batchSize = DEFAULT_EMBEDDING_BATCH_SIZE,
    limit,
    retryFailed = false,
    onProgress,
    maxRequestBytes = MAX_EMBEDDING_REQUEST_BYTES,
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
  if (!Number.isInteger(maxRequestBytes) || maxRequestBytes < 1 || maxRequestBytes > MAX_EMBEDDING_REQUEST_BYTES) {
    throw new RangeError(`maxRequestBytes must be an integer in 1..${MAX_EMBEDDING_REQUEST_BYTES}, got ${maxRequestBytes}`);
  }

  await assertVectorExtensionsAvailable();

  const settings = await getEmbeddingOpenRouterSettings();
  if (!isEmbeddingProviderConfigured(settings)) {
    throw new OpenRouterConfigError("OpenRouter API key not configured. Set it in Admin Embeddings.");
  }

  const config: EmbeddingConfig = toEmbeddingConfig(settings);
  if (config.videoEnabled && !(await isVideoToolingAvailable())) {
    throw new Error("Video embedding is enabled but ffmpeg/ffprobe are not available. Install them or disable video embedding.");
  }

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

    let results: boolean[];
    try {
      results = await computeEmbeddingPostBatch({
        client,
        config,
        posts,
        maxRequestBytes,
      });
    } catch (error) {
      results = await recordFailedEmbeddingBatch({
        posts,
        config,
        error,
      });
    }

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

async function recordFailedEmbeddingBatch(options: {
  posts: EmbeddingPostToProcess[];
  config: EmbeddingConfig;
  error: unknown;
}): Promise<boolean[]> {
  const { posts, config, error } = options;
  const message = error instanceof Error ? error.message : String(error);

  aiLog.warn({ count: posts.length, error: message }, "Embedding batch failed; continuing with next batch");

  const recordLimit = pLimit(FALLBACK_CONCURRENCY);
  await Promise.all(posts.map((post) =>
    recordLimit(async () => {
      try {
        await recordFailedEmbedding({
          post,
          config,
          prepared: null,
          error,
        });
      } catch (recordError) {
        aiLog.warn({
          hash: post.hash,
          error: recordError instanceof Error ? recordError.message : String(recordError),
        }, "Failed to record embedding batch failure");
      }
    })
  ));

  return posts.map(() => false);
}

async function preprocessPost(post: EmbeddingPostToProcess, config: EmbeddingConfig): Promise<PreparedMedia> {
  const filePath = buildFilePath(post.hash, post.extension);
  if (post.mimeType.startsWith("video/")) {
    const video = await preprocessVideoForEmbedding(filePath);
    return {
      input: { type: "video", dataUrl: video.dataUrl, format: video.format },
      sourceWidth: video.sourceWidth,
      sourceHeight: video.sourceHeight,
      processedWidth: video.processedWidth,
      processedHeight: video.processedHeight,
    };
  }

  const image = await preprocessImageForEmbedding(filePath, config.imageMaxResolution);
  return {
    input: { type: "image", dataUrl: image.dataUrl },
    sourceWidth: image.sourceWidth,
    sourceHeight: image.sourceHeight,
    processedWidth: image.processedWidth,
    processedHeight: image.processedHeight,
  };
}

async function computeEmbeddingPostBatch(options: {
  client: OpenRouterClient;
  config: EmbeddingConfig;
  posts: EmbeddingPostToProcess[];
  maxRequestBytes: number;
}): Promise<boolean[]> {
  const { client, config, posts, maxRequestBytes } = options;
  const prepared: Array<{
    post: EmbeddingPostToProcess;
    media: PreparedMedia;
  }> = [];
  const results = new Map<number, boolean>();

  const preprocessLimit = pLimit(PREPROCESS_CONCURRENCY);
  await Promise.all(posts.map((post) =>
    preprocessLimit(async () => {
      try {
        const media = await preprocessPost(post, config);
        prepared.push({ post, media });
      } catch (error) {
        await recordFailedEmbedding({
          post,
          config,
          prepared: null,
          error,
        });
        results.set(post.id, false);
      }
    })
  ));

  for (const chunk of partitionByRequestBytes(prepared, maxRequestBytes)) {
    try {
      const embeddingResults = await client.createMediaEmbeddings({
        model: config.model,
        media: chunk.map(({ media }) => media.input),
        dimensions: config.dimensions,
      });

      const persistenceResults = await Promise.allSettled(chunk.map(async ({ post, media }, index) => {
        const result = embeddingResults[index];
        if (!result) {
          throw new Error("Embedding response did not include every requested input");
        }

        const succeeded = await recordCompleteEmbedding({
          post,
          config,
          prepared: media,
          embedding: result.embedding,
        });
        results.set(post.id, succeeded);
      }));
      const rejectedPersistence = persistenceResults.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (rejectedPersistence) {
        throw rejectedPersistence.reason;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aiLog.warn({ count: chunk.length, error: message }, "Failed to compute batched embeddings; retrying individually");

      const fallbackLimit = pLimit(FALLBACK_CONCURRENCY);
      const unresolved = chunk.filter(({ post }) => results.get(post.id) !== true);
      await Promise.all(unresolved.map(({ post, media }) =>
        fallbackLimit(async () => {
          const succeeded = await computePreparedEmbedding({
            client,
            config,
            post,
            prepared: media,
          });
          results.set(post.id, succeeded);
        })
      ));
    }
  }

  return posts.map((post) => results.get(post.id) ?? false);
}

/**
 * Split prepared media into request-sized chunks, preserving order. An item
 * larger than the budget on its own still gets a chunk (the API decides).
 */
export function partitionByRequestBytes<T extends { media: Pick<PreparedMedia, "input"> }>(
  items: T[],
  maxBytes = MAX_EMBEDDING_REQUEST_BYTES
): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const bytes = item.media.input.dataUrl.length;
    if (current.length > 0 && currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function computePreparedEmbedding(options: {
  client: OpenRouterClient;
  config: EmbeddingConfig;
  post: EmbeddingPostToProcess;
  prepared: PreparedMedia;
}): Promise<boolean> {
  const { client, config, post, prepared } = options;

  try {
    const [result] = await client.createMediaEmbeddings({
      model: config.model,
      media: [prepared.input],
      dimensions: config.dimensions,
    });

    return recordCompleteEmbedding({
      post,
      config,
      prepared,
      embedding: result.embedding,
    });
  } catch (error) {
    await recordFailedEmbedding({
      post,
      config,
      prepared,
      error,
    });
    return false;
  }
}

async function recordCompleteEmbedding(options: {
  post: EmbeddingPostToProcess;
  config: EmbeddingConfig;
  prepared: PreparedMedia;
  embedding: number[];
}): Promise<boolean> {
  const { post, config, prepared, embedding } = options;

  try {
    await upsertCompleteEmbedding({
      postId: post.id,
      config,
      embedding,
      sourceWidth: prepared.sourceWidth,
      sourceHeight: prepared.sourceHeight,
      processedWidth: prepared.processedWidth,
      processedHeight: prepared.processedHeight,
    });
    return true;
  } catch (error) {
    await recordFailedEmbedding({
      post,
      config,
      prepared,
      error,
    });
    return false;
  }
}

async function recordFailedEmbedding(options: {
  post: EmbeddingPostToProcess;
  config: EmbeddingConfig;
  prepared: PreparedMedia | null;
  error: unknown;
}): Promise<void> {
  const { post, config, prepared, error } = options;
  const message = error instanceof Error ? error.message : String(error);

  aiLog.warn({ hash: post.hash, mimeType: post.mimeType, error: message }, "Failed to compute embedding");
  await upsertFailedEmbedding({
    postId: post.id,
    config,
    errorMessage: message,
    sourceWidth: prepared?.sourceWidth ?? post.width,
    sourceHeight: prepared?.sourceHeight ?? post.height,
    processedWidth: prepared?.processedWidth ?? null,
    processedHeight: prepared?.processedHeight ?? null,
  });
}

export async function getCurrentEmbeddingStats(): Promise<{
  settings: Pick<
    EmbeddingSettings,
    "apiKeyConfigured" | "apiKeyRequired" | "maskedApiKey" | "baseUrl" | "model" | "dimensions" | "imageMaxResolution" | "videoEnabled"
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
      videoEnabled: settings.videoEnabled,
    },
    stats,
  };
}
