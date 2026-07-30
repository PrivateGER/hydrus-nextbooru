import { TagCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  type EmbeddingConfig,
  isSupportedEmbeddingDimensions,
} from "@/lib/embeddings/settings";
import { vectorType } from "@/lib/embeddings/store";
import {
  toVectorLiteral,
  validateEmbeddingVector,
} from "@/lib/embeddings/vector";

/**
 * Config identity for tag (text) embeddings: the image preprocessing
 * resolution does not participate, so one tag vocabulary embedding serves
 * every `imageMaxResolution` under the same backend/model/dimensions —
 * matching how SemanticQueryEmbedding keys cached text queries.
 */
export interface TagEmbeddingConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
}

export function toTagEmbeddingConfig(config: EmbeddingConfig): TagEmbeddingConfig {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
  };
}

export interface TagEmbeddingStats {
  totalTags: number;
  embedded: number;
  failed: number;
  pending: number;
}

export interface TagToEmbed {
  id: number;
  name: string;
  category: TagCategory;
}

/** A candidate post's similarity to the query through one of its tags. */
export interface CandidateTagSim {
  postId: number;
  sim: number;
}

/**
 * The text embedded for a tag. Underscores become spaces so danbooru-style
 * tags read as natural phrases. Artist/character/copyright names are proper
 * nouns the model cannot ground from the bare string, so they keep a category
 * prefix; GENERAL keeps its original form (which may carry a sub-namespace)
 * and META stays bare.
 */
export function tagEmbeddingText(name: string, category: TagCategory): string {
  const readable = name.replace(/_/g, " ").trim();
  switch (category) {
    case TagCategory.ARTIST:
      return `artist: ${readable}`;
    case TagCategory.CHARACTER:
      return `character: ${readable}`;
    case TagCategory.COPYRIGHT:
      return `series: ${readable}`;
    default:
      return readable;
  }
}

export async function getTagEmbeddingStats(config: TagEmbeddingConfig): Promise<TagEmbeddingStats> {
  const [totalTags, embedded, failed] = await Promise.all([
    prisma.tag.count(),
    countTagEmbeddingsByStatus(config, "COMPLETE"),
    countTagEmbeddingsByStatus(config, "FAILED"),
  ]);

  return {
    totalTags,
    embedded,
    failed,
    pending: Math.max(0, totalTags - embedded - failed),
  };
}

async function countTagEmbeddingsByStatus(
  config: TagEmbeddingConfig,
  status: "COMPLETE" | "FAILED"
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "TagEmbedding" te
    WHERE te."baseUrl" = ${config.baseUrl}
      AND te.model = ${config.model}
      AND te.dimensions = ${config.dimensions}
      AND te.status = ${status}::"EmbeddingStatus"
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function countPendingTagEmbeddings(
  config: TagEmbeddingConfig,
  retryFailed: boolean
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "Tag" t
    LEFT JOIN "TagEmbedding" te
      ON te."tagId" = t.id
      AND te."baseUrl" = ${config.baseUrl}
      AND te.model = ${config.model}
      AND te.dimensions = ${config.dimensions}
    WHERE (
      (${retryFailed} AND te.status = 'FAILED'::"EmbeddingStatus")
      OR (${!retryFailed} AND te.id IS NULL)
    )
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function findTagsToEmbed(options: {
  config: TagEmbeddingConfig;
  retryFailed: boolean;
  lastId?: number;
  take: number;
}): Promise<TagToEmbed[]> {
  const { config, retryFailed, lastId, take } = options;

  return prisma.$queryRaw<TagToEmbed[]>`
    SELECT t.id, t.name, t.category::text AS category
    FROM "Tag" t
    LEFT JOIN "TagEmbedding" te
      ON te."tagId" = t.id
      AND te."baseUrl" = ${config.baseUrl}
      AND te.model = ${config.model}
      AND te.dimensions = ${config.dimensions}
    WHERE (${lastId === undefined} OR t.id > ${lastId ?? 0})
      AND (
        (${retryFailed} AND te.status = 'FAILED'::"EmbeddingStatus")
        OR (${!retryFailed} AND te.id IS NULL)
      )
    ORDER BY t.id ASC
    LIMIT ${take}
  `;
}

export async function upsertCompleteTagEmbedding(options: {
  tagId: number;
  config: TagEmbeddingConfig;
  embedding: number[];
}): Promise<void> {
  const { tagId, config } = options;
  const embedding = validateEmbeddingVector(options.embedding, config.dimensions);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "TagEmbedding" (
      "tagId", "baseUrl", model, dimensions,
      embedding, status, "errorMessage", "computedAt", "updatedAt"
    )
    VALUES (
      ${tagId}, ${config.baseUrl}, ${config.model}, ${config.dimensions},
      ${vector}::vector, 'COMPLETE'::"EmbeddingStatus", NULL, NOW(), NOW()
    )
    ON CONFLICT ("tagId", "baseUrl", model, dimensions)
    DO UPDATE SET
      embedding = EXCLUDED.embedding,
      status = 'COMPLETE'::"EmbeddingStatus",
      "errorMessage" = NULL,
      "computedAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

export async function upsertFailedTagEmbedding(options: {
  tagId: number;
  config: TagEmbeddingConfig;
  errorMessage: string;
}): Promise<void> {
  const message = options.errorMessage.slice(0, 1000);

  await prisma.$executeRaw`
    INSERT INTO "TagEmbedding" (
      "tagId", "baseUrl", model, dimensions,
      embedding, status, "errorMessage", "computedAt", "updatedAt"
    )
    VALUES (
      ${options.tagId}, ${options.config.baseUrl}, ${options.config.model}, ${options.config.dimensions},
      NULL, 'FAILED'::"EmbeddingStatus", ${message}, NOW(), NOW()
    )
    ON CONFLICT ("tagId", "baseUrl", model, dimensions)
    DO UPDATE SET
      embedding = NULL,
      status = 'FAILED'::"EmbeddingStatus",
      "errorMessage" = EXCLUDED."errorMessage",
      "computedAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

export async function clearTagEmbeddingsForConfig(config: TagEmbeddingConfig): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM "TagEmbedding"
    WHERE "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
  `;
}

export async function deleteFailedTagEmbeddingsForConfig(config: TagEmbeddingConfig): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM "TagEmbedding"
    WHERE "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
      AND status = 'FAILED'::"EmbeddingStatus"
  `;
}

/**
 * Whether any COMPLETE tag embedding exists for the config — the cheap gate
 * that keeps the rerank path (baseline reads + scoring query) entirely off
 * searches on instances that never ran the tag embedding batch.
 */
export async function hasTagEmbeddingsForConfig(config: TagEmbeddingConfig): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "TagEmbedding" te
      WHERE te."baseUrl" = ${config.baseUrl}
        AND te.model = ${config.model}
        AND te.dimensions = ${config.dimensions}
        AND te.status = 'COMPLETE'::"EmbeddingStatus"
        AND te.embedding IS NOT NULL
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

/**
 * For each candidate post, the raw cosine similarities of its `topK`
 * best-matching tags against the query embedding.
 *
 * Distances are computed exactly (no ANN, no vector index): the join is
 * bounded by the candidate window times tags-per-post, and rows are cut to
 * `topK` per post by a window function before leaving the database.
 * Tie-break on tagId keeps the cut deterministic for pagination stability.
 */
export async function scoreCandidateTagSims(options: {
  config: TagEmbeddingConfig;
  embedding: number[];
  postIds: number[];
  topK: number;
}): Promise<CandidateTagSim[]> {
  const { config, topK } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for tag match scoring");
  }
  const postIds = options.postIds.filter((id) => Number.isInteger(id));
  if (postIds.length === 0 || !Number.isInteger(topK) || topK < 1) {
    return [];
  }

  const embedding = validateEmbeddingVector(options.embedding, config.dimensions);
  const vector = toVectorLiteral(embedding);
  const vectorTypeSql = vectorType(config.dimensions);

  const rows = await prisma.$queryRaw<{ postId: number; sim: number }[]>`
    SELECT post_id AS "postId", sim
    FROM (
      SELECT
        pt."postId" AS post_id,
        (1 - (te.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}))::float8 AS sim,
        row_number() OVER (
          PARTITION BY pt."postId"
          ORDER BY te.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}, te."tagId"
        ) AS rn
      FROM "PostTag" pt
      JOIN "TagEmbedding" te
        ON te."tagId" = pt."tagId"
        AND te."baseUrl" = ${config.baseUrl}
        AND te.model = ${config.model}
        AND te.dimensions = ${config.dimensions}
        AND te.status = 'COMPLETE'::"EmbeddingStatus"
        AND te.embedding IS NOT NULL
      WHERE pt."postId" = ANY(${postIds}::int[])
    ) ranked
    WHERE rn <= ${topK}
  `;

  return rows.map((row) => ({ postId: row.postId, sim: Number(row.sim) }));
}
