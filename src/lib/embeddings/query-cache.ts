import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";
import {
  parseVectorLiteral,
  toVectorLiteral,
  validateEmbeddingVector,
} from "@/lib/embeddings/vector";

export interface CachedSemanticQueryEmbedding {
  queryHash: string;
  query: string;
  embedding: number[];
}

export function normalizeSemanticQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function hashSemanticQuery(query: string): string {
  return createHash("sha256").update(query, "utf8").digest("hex");
}

export async function getCachedSemanticQueryEmbedding(
  query: string,
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions">
): Promise<CachedSemanticQueryEmbedding | null> {
  const normalizedQuery = normalizeSemanticQuery(query);
  const queryHash = hashSemanticQuery(normalizedQuery);

  const rows = await prisma.$queryRaw<{ query: string; embedding: string }[]>`
    UPDATE "SemanticQueryEmbedding"
    SET "lastUsedAt" = NOW(), "updatedAt" = NOW()
    WHERE "queryHash" = ${queryHash}
      AND query IS NOT NULL
      AND "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
    RETURNING query, embedding::text AS embedding
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    queryHash,
    query: row.query,
    embedding: validateEmbeddingVector(parseVectorLiteral(row.embedding), config.dimensions),
  };
}

export async function upsertSemanticQueryEmbedding(options: {
  query: string;
  config: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions">;
  embedding: number[];
}): Promise<CachedSemanticQueryEmbedding> {
  const normalizedQuery = normalizeSemanticQuery(options.query);
  const queryHash = hashSemanticQuery(normalizedQuery);
  const embedding = validateEmbeddingVector(options.embedding, options.config.dimensions);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "SemanticQueryEmbedding" (
      "queryHash", query, "baseUrl", model, dimensions, embedding, "lastUsedAt", "updatedAt"
    )
    VALUES (
      ${queryHash}, ${normalizedQuery}, ${options.config.baseUrl}, ${options.config.model}, ${options.config.dimensions},
      ${vector}::vector, NOW(), NOW()
    )
    ON CONFLICT ("queryHash", "baseUrl", model, dimensions)
    DO UPDATE SET
      query = EXCLUDED.query,
      embedding = EXCLUDED.embedding,
      "lastUsedAt" = NOW(),
      "updatedAt" = NOW()
  `;

  return {
    queryHash,
    query: normalizedQuery,
    embedding,
  };
}
