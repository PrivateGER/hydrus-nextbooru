import pLimit from "p-limit";
import { OpenRouterClient, OpenRouterConfigError } from "@/lib/openrouter";
import { EMBEDDING_INPUT_TYPES } from "@/lib/openrouter/types";
import { aiLog } from "@/lib/logger";
import {
  getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured,
  toEmbeddingConfig,
} from "@/lib/embeddings/settings";
import { assertVectorExtensionsAvailable } from "@/lib/embeddings/store";
import {
  countPendingTagEmbeddings,
  findTagsToEmbed,
  tagEmbeddingText,
  toTagEmbeddingConfig,
  upsertCompleteTagEmbedding,
  upsertFailedTagEmbedding,
  type TagEmbeddingConfig,
  type TagToEmbed,
} from "@/lib/embeddings/tag-store";
import type {
  BatchEmbeddingOptions,
  BatchEmbeddingResult,
} from "@/lib/embeddings/batch";

// Tags are short text inputs, so batches can be larger than the image batch
// without hitting request-size limits.
export const DEFAULT_TAG_EMBEDDING_BATCH_SIZE = 64;
export const MAX_TAG_EMBEDDING_BATCH_SIZE = 256;
const FALLBACK_CONCURRENCY = 2;

/**
 * Embed the tag vocabulary for the active embedding config.
 *
 * Same shape as {@link batchComputeImageEmbeddings}: keyset pagination over
 * pending tags, one embeddings request per batch, per-item fallback when a
 * batched request fails, FAILED rows recorded so a retry pass can find them.
 * Tags are embedded as SEARCH_DOCUMENTs — the corpus side of the same
 * query/document space used by cached search queries.
 */
export async function batchComputeTagEmbeddings(
  options: BatchEmbeddingOptions = {}
): Promise<BatchEmbeddingResult> {
  const {
    batchSize = DEFAULT_TAG_EMBEDDING_BATCH_SIZE,
    limit,
    retryFailed = false,
    onProgress,
  } = options;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
  }
  if (batchSize > MAX_TAG_EMBEDDING_BATCH_SIZE) {
    throw new RangeError(`batchSize must be ${MAX_TAG_EMBEDDING_BATCH_SIZE} or less, got ${batchSize}`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError(`limit must be a non-negative integer, got ${limit}`);
  }

  await assertVectorExtensionsAvailable();

  const settings = await getEmbeddingOpenRouterSettings();
  if (!isEmbeddingProviderConfigured(settings)) {
    throw new OpenRouterConfigError("OpenRouter API key not configured. Set it in Admin Embeddings.");
  }

  const config = toTagEmbeddingConfig(toEmbeddingConfig(settings));

  const totalPending = await countPendingTagEmbeddings(config, retryFailed);
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
    const tags = await findTagsToEmbed({ config, retryFailed, lastId, take });

    if (tags.length === 0) break;

    const results = await computeTagEmbeddingBatch({ client, config, tags });

    for (const success of results) {
      processed++;
      if (success) succeeded++;
      else failed++;
    }

    lastId = tags[tags.length - 1].id;
    onProgress?.(processed, total);
  }

  return { processed, succeeded, failed };
}

async function computeTagEmbeddingBatch(options: {
  client: OpenRouterClient;
  config: TagEmbeddingConfig;
  tags: TagToEmbed[];
}): Promise<boolean[]> {
  const { client, config, tags } = options;
  const results = new Map<number, boolean>();

  try {
    const embeddings = await client.createEmbeddings({
      model: config.model,
      input: tags.map((tag) => tagEmbeddingText(tag.name, tag.category)),
      dimensions: config.dimensions,
      encoding_format: "float",
      input_type: EMBEDDING_INPUT_TYPES.SEARCH_DOCUMENT,
    });

    const persistenceResults = await Promise.allSettled(tags.map(async (tag, index) => {
      const result = embeddings[index];
      if (!result) {
        throw new Error("Embedding response did not include every requested input");
      }
      results.set(tag.id, await recordCompleteTagEmbedding({ tag, config, embedding: result.embedding }));
    }));
    const rejected = persistenceResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (rejected) {
      throw rejected.reason;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    aiLog.warn({ count: tags.length, error: message }, "Failed to compute batched tag embeddings; retrying individually");

    const fallbackLimit = pLimit(FALLBACK_CONCURRENCY);
    const unresolved = tags.filter((tag) => results.get(tag.id) !== true);
    await Promise.all(unresolved.map((tag) =>
      fallbackLimit(async () => {
        results.set(tag.id, await computeSingleTagEmbedding({ client, config, tag }));
      })
    ));
  }

  return tags.map((tag) => results.get(tag.id) ?? false);
}

async function computeSingleTagEmbedding(options: {
  client: OpenRouterClient;
  config: TagEmbeddingConfig;
  tag: TagToEmbed;
}): Promise<boolean> {
  const { client, config, tag } = options;

  try {
    const result = await client.createEmbedding({
      model: config.model,
      input: tagEmbeddingText(tag.name, tag.category),
      dimensions: config.dimensions,
      encoding_format: "float",
      input_type: EMBEDDING_INPUT_TYPES.SEARCH_DOCUMENT,
    });

    return recordCompleteTagEmbedding({ tag, config, embedding: result.embedding });
  } catch (error) {
    await recordFailedTagEmbedding({ tag, config, error });
    return false;
  }
}

async function recordCompleteTagEmbedding(options: {
  tag: TagToEmbed;
  config: TagEmbeddingConfig;
  embedding: number[];
}): Promise<boolean> {
  const { tag, config, embedding } = options;

  try {
    await upsertCompleteTagEmbedding({ tagId: tag.id, config, embedding });
    return true;
  } catch (error) {
    await recordFailedTagEmbedding({ tag, config, error });
    return false;
  }
}

async function recordFailedTagEmbedding(options: {
  tag: TagToEmbed;
  config: TagEmbeddingConfig;
  error: unknown;
}): Promise<void> {
  const { tag, config, error } = options;
  const message = error instanceof Error ? error.message : String(error);

  aiLog.warn({ tagId: tag.id, tag: tag.name, error: message }, "Failed to compute tag embedding");
  try {
    await upsertFailedTagEmbedding({ tagId: tag.id, config, errorMessage: message });
  } catch (recordError) {
    aiLog.warn({
      tagId: tag.id,
      error: recordError instanceof Error ? recordError.message : String(recordError),
    }, "Failed to record tag embedding failure");
  }
}
