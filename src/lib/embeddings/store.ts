import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { EMBEDDING_SUPPORTED_MIMES } from "@/lib/embeddings/image";
import {
  type EmbeddingConfig,
  isSupportedEmbeddingDimensions,
} from "@/lib/embeddings/settings";
import {
  parseVectorLiteral,
  toVectorLiteral,
  validateEmbeddingVector,
} from "@/lib/embeddings/vector";

/**
 * Build the `vector(N)` pgvector type fragment for raw SQL.
 *
 * Defense-in-depth: `dimensions` is interpolated into raw SQL via Prisma.raw,
 * which performs no escaping. Even though every caller already validates the
 * value upstream, assert here — at the construction site — that it is a
 * positive integer so a future caller cannot introduce SQL injection.
 */
export function vectorType(dimensions: number): Prisma.Sql {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`Invalid embedding dimensions for vector type: ${dimensions}`);
  }
  return Prisma.raw(`vector(${dimensions})`);
}

export interface EmbeddingStats {
  total: number;
  supported: number;
  embedded: number;
  pending: number;
  failed: number;
  unsupported: number;
  extensions: {
    vector: string | null;
    vchord: string | null;
  };
}

export interface EmbeddingPostToProcess {
  id: number;
  hash: string;
  extension: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface SemanticPostResult {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  distance: number;
  score: number;
}

export interface EmbeddedRelatedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  distance: number;
  score: number;
}

export const DEFAULT_EMBEDDING_MIN_SCORE = 0.25;
const RELATED_EMBEDDING_CANDIDATE_LIMIT = 200;

function normalizeEmbeddingMinScore(minScore: number | undefined): number | null {
  if (minScore === undefined || !Number.isFinite(minScore)) {
    return null;
  }

  return Math.min(1, Math.max(-1, minScore));
}

export async function getEmbeddingStats(config: EmbeddingConfig): Promise<EmbeddingStats> {
  const [total, supported, embedded, failed, extensions] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { mimeType: { in: [...EMBEDDING_SUPPORTED_MIMES] } } }),
    countEmbeddingsByStatus(config, "COMPLETE"),
    countEmbeddingsByStatus(config, "FAILED"),
    getVectorExtensionVersions(),
  ]);

  return {
    total,
    supported,
    embedded,
    failed,
    pending: Math.max(0, supported - embedded - failed),
    unsupported: Math.max(0, total - supported),
    extensions,
  };
}

export async function getVectorExtensionVersions(): Promise<EmbeddingStats["extensions"]> {
  const rows = await prisma.$queryRaw<{ extname: string; extversion: string }[]>`
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname IN ('vector', 'vchord')
  `;

  const byName = new Map(rows.map((row) => [row.extname, row.extversion]));
  return {
    vector: byName.get("vector") ?? null,
    vchord: byName.get("vchord") ?? null,
  };
}

export async function assertVectorExtensionsAvailable(): Promise<void> {
  const extensions = await getVectorExtensionVersions();
  if (!extensions.vector || !extensions.vchord) {
    throw new Error("Database is missing required vector extensions. Use tensorchord/vchord-postgres:pg18-v1.1.1.");
  }
}

export async function clearEmbeddingsForConfig(config: EmbeddingConfig): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM "PostEmbedding"
    WHERE "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
      AND "imageMaxResolution" = ${config.imageMaxResolution}
  `;

  return result;
}

export async function deleteFailedEmbeddingsForConfig(config: EmbeddingConfig): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM "PostEmbedding"
    WHERE "baseUrl" = ${config.baseUrl}
      AND model = ${config.model}
      AND dimensions = ${config.dimensions}
      AND "imageMaxResolution" = ${config.imageMaxResolution}
      AND status = 'FAILED'::"EmbeddingStatus"
  `;

  return result;
}

export async function countPendingEmbeddings(
  config: EmbeddingConfig,
  retryFailed: boolean
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "Post" p
    LEFT JOIN "PostEmbedding" pe
      ON pe."postId" = p.id
      AND pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
    WHERE p."mimeType" IN (${Prisma.join([...EMBEDDING_SUPPORTED_MIMES])})
      AND (
        (${retryFailed} AND pe.status = 'FAILED'::"EmbeddingStatus")
        OR (${!retryFailed} AND pe.id IS NULL)
      )
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function findEmbeddingPostsToProcess(options: {
  config: EmbeddingConfig;
  retryFailed: boolean;
  lastId?: number;
  take: number;
}): Promise<EmbeddingPostToProcess[]> {
  const { config, retryFailed, lastId, take } = options;

  return prisma.$queryRaw<EmbeddingPostToProcess[]>`
    SELECT p.id, p.hash, p.extension, p."mimeType", p.width, p.height
    FROM "Post" p
    LEFT JOIN "PostEmbedding" pe
      ON pe."postId" = p.id
      AND pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
    WHERE p."mimeType" IN (${Prisma.join([...EMBEDDING_SUPPORTED_MIMES])})
      AND (${lastId === undefined} OR p.id > ${lastId ?? 0})
      AND (
        (${retryFailed} AND pe.status = 'FAILED'::"EmbeddingStatus")
        OR (${!retryFailed} AND pe.id IS NULL)
      )
    ORDER BY p.id ASC
    LIMIT ${take}
  `;
}

export async function upsertCompleteEmbedding(options: {
  postId: number;
  config: EmbeddingConfig;
  embedding: number[];
  sourceWidth: number | null;
  sourceHeight: number | null;
  processedWidth: number;
  processedHeight: number;
}): Promise<void> {
  const { postId, config, sourceWidth, sourceHeight, processedWidth, processedHeight } = options;
  const embedding = validateEmbeddingVector(options.embedding, config.dimensions);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "PostEmbedding" (
      "postId", "baseUrl", model, dimensions, "imageMaxResolution",
      "sourceWidth", "sourceHeight", "processedWidth", "processedHeight",
      embedding, status, "errorMessage", "computedAt", "updatedAt"
    )
    VALUES (
      ${postId}, ${config.baseUrl}, ${config.model}, ${config.dimensions}, ${config.imageMaxResolution},
      ${sourceWidth}, ${sourceHeight}, ${processedWidth}, ${processedHeight},
      ${vector}::vector, 'COMPLETE'::"EmbeddingStatus", NULL, NOW(), NOW()
    )
    ON CONFLICT ("postId", "baseUrl", model, dimensions, "imageMaxResolution")
    DO UPDATE SET
      "sourceWidth" = EXCLUDED."sourceWidth",
      "sourceHeight" = EXCLUDED."sourceHeight",
      "processedWidth" = EXCLUDED."processedWidth",
      "processedHeight" = EXCLUDED."processedHeight",
      embedding = EXCLUDED.embedding,
      status = 'COMPLETE'::"EmbeddingStatus",
      "errorMessage" = NULL,
      "computedAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

export async function upsertFailedEmbedding(options: {
  postId: number;
  config: EmbeddingConfig;
  errorMessage: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  processedWidth?: number | null;
  processedHeight?: number | null;
}): Promise<void> {
  const message = options.errorMessage.slice(0, 1000);

  await prisma.$executeRaw`
    INSERT INTO "PostEmbedding" (
      "postId", "baseUrl", model, dimensions, "imageMaxResolution",
      "sourceWidth", "sourceHeight", "processedWidth", "processedHeight",
      embedding, status, "errorMessage", "computedAt", "updatedAt"
    )
    VALUES (
      ${options.postId}, ${options.config.baseUrl}, ${options.config.model}, ${options.config.dimensions}, ${options.config.imageMaxResolution},
      ${options.sourceWidth ?? null}, ${options.sourceHeight ?? null}, ${options.processedWidth ?? null}, ${options.processedHeight ?? null},
      NULL, 'FAILED'::"EmbeddingStatus", ${message}, NOW(), NOW()
    )
    ON CONFLICT ("postId", "baseUrl", model, dimensions, "imageMaxResolution")
    DO UPDATE SET
      "sourceWidth" = EXCLUDED."sourceWidth",
      "sourceHeight" = EXCLUDED."sourceHeight",
      "processedWidth" = EXCLUDED."processedWidth",
      "processedHeight" = EXCLUDED."processedHeight",
      embedding = NULL,
      status = 'FAILED'::"EmbeddingStatus",
      "errorMessage" = EXCLUDED."errorMessage",
      "computedAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

export async function searchPostsByEmbedding(options: {
  config: EmbeddingConfig;
  embedding: number[];
  skip: number;
  limit: number;
  minScore?: number;
  resultCap?: number;
  /** Exclude this post from the results (e.g. the source image when searching from an existing post). */
  excludePostId?: number;
}): Promise<{ posts: SemanticPostResult[]; totalCount: number }> {
  const { config, skip, limit } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const embedding = validateEmbeddingVector(options.embedding, config.dimensions);
  const vector = toVectorLiteral(embedding);
  const vectorTypeSql = vectorType(config.dimensions);
  const minScore = normalizeEmbeddingMinScore(options.minScore);
  const maxDistance = minScore === null ? null : 1 - minScore;
  const resultCap = options.resultCap === undefined || !Number.isFinite(options.resultCap)
    ? null
    : Math.min(Math.max(1, Math.floor(options.resultCap)), 1000);
  // Mirror the nullable-parameter pattern used for maxDistance below rather than
  // splicing a Prisma.sql fragment into $queryRaw: a NULL id disables the filter.
  const excludePostId =
    options.excludePostId !== undefined && Number.isInteger(options.excludePostId)
      ? options.excludePostId
      : null;

  type ResultRow = {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
    distance: number;
  };

  if (resultCap !== null) {
    const rows = await prisma.$queryRaw<ResultRow[]>`
      SELECT
        p.id,
        p.hash,
        p.width,
        p.height,
        p.blurhash,
        p."mimeType",
        (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql})::float8 AS distance
      FROM "PostEmbedding" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE pe."baseUrl" = ${config.baseUrl}
        AND pe.model = ${config.model}
        AND pe.dimensions = ${config.dimensions}
        AND pe."imageMaxResolution" = ${config.imageMaxResolution}
        AND pe.status = 'COMPLETE'::"EmbeddingStatus"
        AND pe.embedding IS NOT NULL
        AND (${excludePostId}::int IS NULL OR pe."postId" <> ${excludePostId}::int)
        AND (${maxDistance}::float8 IS NULL OR (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql})::float8 <= ${maxDistance})
      ORDER BY pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}
      LIMIT ${resultCap}
    `;

    return {
      posts: rows.slice(skip, skip + limit).map((row) => ({
        ...row,
        distance: Number(row.distance),
        score: 1 - Number(row.distance),
      })),
      totalCount: rows.length,
    };
  }

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<ResultRow[]>`
      SELECT
        p.id,
        p.hash,
        p.width,
        p.height,
        p.blurhash,
        p."mimeType",
        (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql})::float8 AS distance
      FROM "PostEmbedding" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE pe."baseUrl" = ${config.baseUrl}
        AND pe.model = ${config.model}
        AND pe.dimensions = ${config.dimensions}
        AND pe."imageMaxResolution" = ${config.imageMaxResolution}
        AND pe.status = 'COMPLETE'::"EmbeddingStatus"
        AND pe.embedding IS NOT NULL
        AND (${excludePostId}::int IS NULL OR pe."postId" <> ${excludePostId}::int)
        AND (${maxDistance}::float8 IS NULL OR (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql})::float8 <= ${maxDistance})
      ORDER BY pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "PostEmbedding" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE pe."baseUrl" = ${config.baseUrl}
        AND pe.model = ${config.model}
        AND pe.dimensions = ${config.dimensions}
        AND pe."imageMaxResolution" = ${config.imageMaxResolution}
        AND pe.status = 'COMPLETE'::"EmbeddingStatus"
        AND pe.embedding IS NOT NULL
        AND (${excludePostId}::int IS NULL OR pe."postId" <> ${excludePostId}::int)
        AND (${maxDistance}::float8 IS NULL OR (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql})::float8 <= ${maxDistance})
    `,
  ]);

  return {
    posts: rows.map((row) => ({
      ...row,
      distance: Number(row.distance),
      score: 1 - Number(row.distance),
    })),
    totalCount: Number(counts[0]?.count ?? 0n),
  };
}

/**
 * Read an existing post's stored image embedding for the active config.
 *
 * Returns the post's numeric id (so the caller can exclude it from a neighbor
 * search) and its embedding vector, or `null` when the post has no COMPLETE
 * embedding under the current (baseUrl, model, dimensions, imageMaxResolution)
 * config — e.g. it was never embedded, or an admin switched models since.
 */
export async function getPostEmbeddingVector(options: {
  hash: string;
  config: EmbeddingConfig;
}): Promise<{ postId: number; embedding: number[] } | null> {
  const { hash, config } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const rows = await prisma.$queryRaw<{ postId: number; embedding: string }[]>`
    SELECT pe."postId", pe.embedding::text AS embedding
    FROM "PostEmbedding" pe
    JOIN "Post" p ON p.id = pe."postId"
    WHERE p.hash = ${hash}
      AND pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
      AND pe.status = 'COMPLETE'::"EmbeddingStatus"
      AND pe.embedding IS NOT NULL
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    postId: Number(row.postId),
    embedding: validateEmbeddingVector(parseVectorLiteral(row.embedding), config.dimensions),
  };
}

export async function findRelatedPostsByEmbedding(options: {
  hash: string;
  config: EmbeddingConfig;
  limit: number;
  minScore?: number;
}): Promise<EmbeddedRelatedPost[]> {
  const { hash, config } = options;
  const requestedLimit = Number.isFinite(options.limit) ? Math.floor(options.limit) : 10;
  const limit = Math.min(Math.max(1, requestedLimit), 20);

  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const vectorTypeSql = vectorType(config.dimensions);
  const minScore = normalizeEmbeddingMinScore(options.minScore);
  const maxDistance = minScore === null ? null : 1 - minScore;
  const maxDistanceFilter = maxDistance === null
    ? Prisma.empty
    : Prisma.sql`AND (pe.embedding::${vectorTypeSql} <=> source.embedding)::float8 <= ${maxDistance}`;

  type ResultRow = {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
    distance: number;
  };

  const rows = await prisma.$queryRaw<ResultRow[]>`
    WITH source AS (
      SELECT pe.embedding::${vectorTypeSql} AS embedding, p.id AS post_id
      FROM "Post" p
      JOIN "PostEmbedding" pe ON pe."postId" = p.id
      WHERE p.hash = ${hash}
        AND pe."baseUrl" = ${config.baseUrl}
        AND pe.model = ${config.model}
        AND pe.dimensions = ${config.dimensions}
        AND pe."imageMaxResolution" = ${config.imageMaxResolution}
        AND pe.status = 'COMPLETE'::"EmbeddingStatus"
        AND pe.embedding IS NOT NULL
      LIMIT 1
    )
    SELECT
      related.id,
      related.hash,
      related.width,
      related.height,
      related.blurhash,
      related."mimeType",
      nearest.distance
    FROM source
    CROSS JOIN LATERAL (
      SELECT
        pe."postId",
        (pe.embedding::${vectorTypeSql} <=> source.embedding)::float8 AS distance
      FROM "PostEmbedding" pe
      WHERE pe."baseUrl" = ${config.baseUrl}
        AND pe.model = ${config.model}
        AND pe.dimensions = ${config.dimensions}
        AND pe."imageMaxResolution" = ${config.imageMaxResolution}
        AND pe.status = 'COMPLETE'::"EmbeddingStatus"
        AND pe.embedding IS NOT NULL
        AND pe."postId" <> source.post_id
        ${maxDistanceFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM "PostGroup" source_group
          JOIN "PostGroup" related_group ON related_group."groupId" = source_group."groupId"
          WHERE source_group."postId" = source.post_id
            AND related_group."postId" = pe."postId"
        )
      ORDER BY pe.embedding::${vectorTypeSql} <=> source.embedding
      LIMIT ${RELATED_EMBEDDING_CANDIDATE_LIMIT}
    ) nearest
    JOIN "Post" related ON related.id = nearest."postId"
    ORDER BY nearest.distance
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    distance: Number(row.distance),
    score: 1 - Number(row.distance),
  }));
}

async function countEmbeddingsByStatus(
  config: EmbeddingConfig,
  status: "COMPLETE" | "FAILED"
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "PostEmbedding" pe
    JOIN "Post" p ON p.id = pe."postId"
    WHERE pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
      AND pe.status = ${status}::"EmbeddingStatus"
      AND p."mimeType" IN (${Prisma.join([...EMBEDDING_SUPPORTED_MIMES])})
  `;

  return Number(rows[0]?.count ?? 0n);
}
