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
 * Identical byte content always yields the same hash, so a previously embedded
 * query image is served from cache instead of re-calling the embedding provider.
 */
export function hashImageBytes(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertValidImageHash(imageHash: string): void {
  if (!IMAGE_HASH_PATTERN.test(imageHash)) {
    throw new TypeError("Image hash must be a 64-character lowercase hex string");
  }
}

/**
 * Look up a cached query-image embedding for the active embedding config,
 * refreshing `lastUsedAt` so least-recently-used pruning stays accurate.
 *
 * Query images share the `SemanticQueryEmbedding` cache with text queries; an
 * image row is identified by `queryHash = <image byte hash>` and `query = NULL`.
 * Returns `null` when no row matches the (hash, baseUrl, model, dimensions) key.
 */
export async function getCachedImageQueryEmbedding(
  imageHash: string,
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions">
): Promise<CachedImageQueryEmbedding | null> {
  assertValidImageHash(imageHash);

  const rows = await prisma.$queryRaw<{ embedding: string }[]>`
    UPDATE "SemanticQueryEmbedding"
    SET "lastUsedAt" = NOW(), "updatedAt" = NOW()
    WHERE "queryHash" = ${imageHash}
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
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions">;
  embedding: number[];
}): Promise<CachedImageQueryEmbedding> {
  assertValidImageHash(options.imageHash);
  const embedding = validateEmbeddingVector(options.embedding, options.config.dimensions);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "SemanticQueryEmbedding" (
      "queryHash", query, "baseUrl", model, dimensions, embedding, "lastUsedAt", "updatedAt"
    )
    VALUES (
      ${options.imageHash}, NULL, ${options.config.baseUrl}, ${options.config.model}, ${options.config.dimensions},
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
