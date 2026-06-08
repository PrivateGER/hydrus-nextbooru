import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";
import {
  parseVectorLiteral,
  toVectorLiteral,
  validateEmbeddingVector,
} from "@/lib/embeddings/vector";

export interface CachedImageQueryEmbedding {
  imageHash: string;
  embedding: number[];
}

const IMAGE_HASH_PATTERN = /^[a-f0-9]{64}$/;

/**
 * SHA-256 hex digest of the raw (pre-processing) uploaded image bytes.
 *
 * Identical byte content always yields the same public hash. The stored cache
 * key also includes preprocessing settings that can change the embedded vector.
 */
export function hashImageBytes(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertValidImageHash(imageHash: string): void {
  if (!IMAGE_HASH_PATTERN.test(imageHash)) {
    throw new TypeError("Image hash must be a 64-character lowercase hex string");
  }
}

export function hashImageQueryCacheKey(imageHash: string, imageMaxResolution: number): string {
  assertValidImageHash(imageHash);
  if (!Number.isInteger(imageMaxResolution) || imageMaxResolution < 1) {
    throw new RangeError("imageMaxResolution must be a positive integer");
  }

  return createHash("sha256")
    .update("semantic-image-query\0", "utf8")
    .update(imageHash, "utf8")
    .update("\0", "utf8")
    .update(String(imageMaxResolution), "utf8")
    .digest("hex");
}

/**
 * Look up a cached query-image embedding for the active embedding config,
 * refreshing `lastUsedAt` so least-recently-used pruning stays accurate.
 *
 * Query images share the `SemanticQueryEmbedding` cache with text queries; an
 * image row is identified by a hash derived from the raw image-byte hash and
 * preprocessing resolution, with `query = NULL`.
 * Returns `null` when no row matches the (hash, baseUrl, model, dimensions,
 * imageMaxResolution) key.
 */
export async function getCachedImageQueryEmbedding(
  imageHash: string,
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions" | "imageMaxResolution">
): Promise<CachedImageQueryEmbedding | null> {
  const queryHash = hashImageQueryCacheKey(imageHash, config.imageMaxResolution);

  const rows = await prisma.$queryRaw<{ embedding: string }[]>`
    UPDATE "SemanticQueryEmbedding"
    SET "lastUsedAt" = NOW(), "updatedAt" = NOW()
    WHERE "queryHash" = ${queryHash}
      AND query IS NULL
      AND "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
    RETURNING embedding::text AS embedding
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    imageHash,
    embedding: validateEmbeddingVector(parseVectorLiteral(row.embedding), config.dimensions),
  };
}

/**
 * Insert or refresh the cached embedding for a query image. The embedding is
 * validated against the configured dimension before any write occurs. Stored in
 * the shared `SemanticQueryEmbedding` table with a NULL `query` (no text source).
 */
export async function upsertImageQueryEmbedding(options: {
  imageHash: string;
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions" | "imageMaxResolution">;
  embedding: number[];
}): Promise<CachedImageQueryEmbedding> {
  const queryHash = hashImageQueryCacheKey(options.imageHash, options.config.imageMaxResolution);
  const embedding = validateEmbeddingVector(options.embedding, options.config.dimensions);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "SemanticQueryEmbedding" (
      "queryHash", query, "baseUrl", model, dimensions, embedding, "lastUsedAt", "updatedAt"
    )
    VALUES (
      ${queryHash}, NULL, ${options.config.baseUrl}, ${options.config.model}, ${options.config.dimensions},
      ${vector}::vector, NOW(), NOW()
    )
    ON CONFLICT ("queryHash", "baseUrl", model, dimensions)
    DO UPDATE SET
      embedding = EXCLUDED.embedding,
      "lastUsedAt" = NOW(),
      "updatedAt" = NOW()
  `;

  return {
    imageHash: options.imageHash,
    embedding,
  };
}
