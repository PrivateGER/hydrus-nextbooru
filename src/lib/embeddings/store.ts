import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { EMBEDDING_SUPPORTED_IMAGE_MIMES } from "@/lib/embeddings/mimes";
import {
  type EmbeddingConfig,
  isSupportedEmbeddingDimensions,
} from "@/lib/embeddings/settings";
import { aiLog } from "@/lib/logger";
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
// Prod measurements showed one mega-query for ~109 seeds stays single-backend
// bound, while per-seed fan-out burns round trips and pool slots. Sixteen seeds
// per LATERAL query keeps multi-core parallelism with about seven round trips.
const RELATED_EMBEDDING_SEED_CHUNK_SIZE = 16;
const EMBEDDING_VECTOR_POST_CHUNK_SIZE = 500;
const MAX_SIMILARITY_CANDIDATE_CHUNK_SIZE = 1000;
/**
 * Clamp an optional similarity floor to [-1, 1]; null disables it.
 *
 * The floor is ALWAYS applied in JS to rows already fetched by a fixed-LIMIT
 * ANN scan — never as a SQL distance predicate. The predicate and the scan's
 * ORDER BY are the same expression, so floor-passing rows form a contiguous
 * prefix of the scan order: filtering afterwards is result-identical, while
 * a predicate the neighborhood cannot satisfy keeps the index scan from ever
 * reaching its LIMIT and degrades it into a full walk of the vector index.
 */
function normalizeEmbeddingMinScore(minScore: number | undefined): number | null {
  if (minScore === undefined || !Number.isFinite(minScore)) {
    return null;
  }

  return Math.min(1, Math.max(-1, minScore));
}

/** SQL predicate for posts the active config can embed (`p` is the Post alias). */
function eligibleMimeSql(config: EmbeddingConfig): Prisma.Sql {
  return Prisma.sql`(
    p."mimeType" IN (${Prisma.join([...EMBEDDING_SUPPORTED_IMAGE_MIMES])})
    OR (${config.videoEnabled} AND p."mimeType" LIKE 'video/%')
  )`;
}

export async function getEmbeddingStats(config: EmbeddingConfig): Promise<EmbeddingStats> {
  // embedded counts every row "clear" deletes; failed/pending are the
  // eligibility-filtered sets that "retry"/"compute" actually process, so rows
  // for media that is no longer eligible (videos after disabling) don't
  // advertise work the batch would skip.
  const [total, supported, embedded, failed, pending, extensions] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({
      where: {
        OR: [
          { mimeType: { in: [...EMBEDDING_SUPPORTED_IMAGE_MIMES] } },
          ...(config.videoEnabled ? [{ mimeType: { startsWith: "video/" } }] : []),
        ],
      },
    }),
    countEmbeddingsByStatus(config, "COMPLETE"),
    countPendingEmbeddings(config, true),
    countPendingEmbeddings(config, false),
    getVectorExtensionVersions(),
  ]);

  return {
    total,
    supported,
    embedded,
    failed,
    pending,
    unsupported: Math.max(0, total - supported),
    extensions,
  };
}

async function getVectorExtensionVersions(): Promise<EmbeddingStats["extensions"]> {
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

/**
 * Video samples are produced at a fixed resolution, so their vectors are
 * identical under every `imageMaxResolution`. When the admin changes that
 * setting, move existing video rows to the new key instead of re-embedding
 * them. Where a post already has a row under the new key, the COMPLETE row
 * wins (the existing target if both are); the loser is deleted so a FAILED
 * row never displaces a valid vector and the toggle never leaves duplicates.
 */
export async function rekeyVideoEmbeddings(
  from: Pick<EmbeddingConfig, "baseUrl" | "model" | "dimensions" | "imageMaxResolution">,
  toImageMaxResolution: number
): Promise<number> {
  if (from.imageMaxResolution === toImageMaxResolution) return 0;

  const conflictSql = Prisma.sql`
    USING "PostEmbedding" other, "Post" p
    WHERE p.id = pe."postId"
      AND p."mimeType" LIKE 'video/%'
      AND other."postId" = pe."postId"
      AND other."baseUrl" = pe."baseUrl"
      AND other.model = pe.model
      AND other.dimensions = pe.dimensions
      AND pe."baseUrl" = ${from.baseUrl}
      AND pe.model = ${from.model}
      AND pe.dimensions = ${from.dimensions}
  `;

  const [, , moved] = await prisma.$transaction([
    // Drop a source row that would collide with a COMPLETE target.
    prisma.$executeRaw`
      DELETE FROM "PostEmbedding" pe
      ${conflictSql}
        AND pe."imageMaxResolution" = ${from.imageMaxResolution}
        AND other."imageMaxResolution" = ${toImageMaxResolution}
        AND other.status = 'COMPLETE'::"EmbeddingStatus"
    `,
    // Drop a target row that a remaining source row will replace.
    prisma.$executeRaw`
      DELETE FROM "PostEmbedding" pe
      ${conflictSql}
        AND pe."imageMaxResolution" = ${toImageMaxResolution}
        AND other."imageMaxResolution" = ${from.imageMaxResolution}
    `,
    prisma.$executeRaw`
      UPDATE "PostEmbedding" pe
      SET "imageMaxResolution" = ${toImageMaxResolution}, "updatedAt" = NOW()
      FROM "Post" p
      WHERE p.id = pe."postId"
        AND p."mimeType" LIKE 'video/%'
        AND pe."baseUrl" = ${from.baseUrl}
        AND pe.model = ${from.model}
        AND pe.dimensions = ${from.dimensions}
        AND pe."imageMaxResolution" = ${from.imageMaxResolution}
    `,
  ]);

  return moved;
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
    WHERE ${eligibleMimeSql(config)}
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
    WHERE ${eligibleMimeSql(config)}
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
  // Semantic search is top-N by design: one bounded ANN scan, then
  // pagination, floor, and count over that window in JS. There is no exact
  // uncapped count — with a user-controlled minScore it would require
  // computing the distance of every stored embedding per request.
  const resultCap = options.resultCap === undefined || !Number.isFinite(options.resultCap)
    ? 1000
    : Math.min(Math.max(1, Math.floor(options.resultCap)), 1000);
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
    ORDER BY pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}
    LIMIT ${resultCap}
  `;

  // Floor in JS (see normalizeEmbeddingMinScore): passing rows are a prefix
  // of the distance order, so filtering the fetched window is identical to
  // the old SQL prefilter for every page.
  const passing =
    maxDistance === null
      ? rows
      : rows.filter((row) => Number(row.distance) <= maxDistance);

  return {
    posts: passing.slice(skip, skip + limit).map((row) => ({
      ...row,
      distance: Number(row.distance),
      score: 1 - Number(row.distance),
    })),
    totalCount: passing.length,
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
/**
 * Read COMPLETE embedding vectors for the requested posts under the active
 * config. Missing posts are omitted and rows have no guaranteed order.
 */
export async function getEmbeddingVectorsForPosts(options: {
  postIds: number[];
  config: EmbeddingConfig;
}): Promise<{ postId: number; vector: Float32Array }[]> {
  const { config } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const uniquePostIds = new Set<number>();
  for (const postId of options.postIds) {
    if (Number.isInteger(postId)) uniquePostIds.add(postId);
  }
  const postIds = [...uniquePostIds];
  if (postIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let index = 0; index < postIds.length; index += EMBEDDING_VECTOR_POST_CHUNK_SIZE) {
    chunks.push(postIds.slice(index, index + EMBEDDING_VECTOR_POST_CHUNK_SIZE));
  }

  const chunkRows = await Promise.all(
    chunks.map((chunk) =>
      prisma.$queryRaw<{ postId: number; embedding: string }[]>`
        SELECT pe."postId", pe.embedding::text AS embedding
        FROM "PostEmbedding" pe
        WHERE pe."postId" = ANY(${chunk}::int[])
          AND pe."baseUrl" = ${config.baseUrl}
          AND pe.model = ${config.model}
          AND pe.dimensions = ${config.dimensions}
          AND pe."imageMaxResolution" = ${config.imageMaxResolution}
          AND pe.status = 'COMPLETE'::"EmbeddingStatus"
          AND pe.embedding IS NOT NULL
      `
    )
  );

  return chunkRows.flatMap((rows) =>
    rows.map((row) => ({
      postId: Number(row.postId),
      vector: Float32Array.from(
        validateEmbeddingVector(parseVectorLiteral(row.embedding), config.dimensions)
      ),
    }))
  );
}

/**
 * Find the nearest COMPLETE embeddings to a literal vector under the active
 * config, returning raw cosine similarity.
 *
 * This deliberately uses a fixed-LIMIT ANN scan with no distance predicate,
 * for the same reason documented by normalizeEmbeddingMinScore above: an
 * unsatisfiable predicate can force a full vector-index walk before LIMIT.
 */
export async function findNearestByVector(options: {
  vector: ArrayLike<number>;
  config: EmbeddingConfig;
  limit: number;
}): Promise<{ postId: number; score: number }[]> {
  const { config } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const embedding = validateEmbeddingVector(Array.from(options.vector), config.dimensions);
  const vector = toVectorLiteral(embedding);
  const vectorTypeSql = vectorType(config.dimensions);
  const requestedLimit = Number.isFinite(options.limit) ? Math.floor(options.limit) : 1;
  const limit = Math.min(Math.max(1, requestedLimit), 500);

  const rows = await prisma.$queryRaw<{ postId: number; score: number }[]>`
    SELECT
      pe."postId",
      (1 - (pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}))::float8 AS score
    FROM "PostEmbedding" pe
    WHERE pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
      AND pe.status = 'COMPLETE'::"EmbeddingStatus"
      AND pe.embedding IS NOT NULL
    ORDER BY pe.embedding::${vectorTypeSql} <=> ${vector}::${vectorTypeSql}
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    postId: Number(row.postId),
    score: Number(row.score),
  }));
}

/**
 * Compute each candidate's maximum raw cosine similarity to the supplied
 * reference posts. Candidates without a COMPLETE computable pair are absent.
 * Each statement compares at most 1,000 candidates with 200 references.
 */
export async function getMaxSimilarityToReferences(options: {
  candidateIds: number[];
  referenceIds: number[];
  config: EmbeddingConfig;
}): Promise<Map<number, number>> {
  const similarities = new Map<number, number>();
  if (options.candidateIds.length === 0 || options.referenceIds.length === 0) {
    return similarities;
  }

  const { config } = options;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const vectorTypeSql = vectorType(config.dimensions);
  const candidateChunks: number[][] = [];
  for (
    let index = 0;
    index < options.candidateIds.length;
    index += MAX_SIMILARITY_CANDIDATE_CHUNK_SIZE
  ) {
    candidateChunks.push(
      options.candidateIds.slice(index, index + MAX_SIMILARITY_CANDIDATE_CHUNK_SIZE)
    );
  }

  const referenceChunks: number[][] = [];
  for (let index = 0; index < options.referenceIds.length; index += 200) {
    referenceChunks.push(options.referenceIds.slice(index, index + 200));
  }

  for (const candidateIds of candidateChunks) {
    const chunkRows = await Promise.all(
      referenceChunks.map((referenceIds) =>
        prisma.$queryRaw<{ postId: number; similarity: number }[]>`
          SELECT
            candidate.id AS "postId",
            max(
              1 - (
                reference_embedding.embedding::${vectorTypeSql}
                <=> candidate_embedding.embedding::${vectorTypeSql}
              )
            )::float8 AS similarity
          FROM unnest(${candidateIds}::int[]) AS candidate(id)
          CROSS JOIN unnest(${referenceIds}::int[]) AS reference(id)
          JOIN "PostEmbedding" reference_embedding
            ON reference_embedding."postId" = reference.id
           AND reference_embedding."baseUrl" = ${config.baseUrl}
           AND reference_embedding.model = ${config.model}
           AND reference_embedding.dimensions = ${config.dimensions}
           AND reference_embedding."imageMaxResolution" = ${config.imageMaxResolution}
           AND reference_embedding.status = 'COMPLETE'::"EmbeddingStatus"
           AND reference_embedding.embedding IS NOT NULL
          JOIN "PostEmbedding" candidate_embedding
            ON candidate_embedding."postId" = candidate.id
           AND candidate_embedding."baseUrl" = ${config.baseUrl}
           AND candidate_embedding.model = ${config.model}
           AND candidate_embedding.dimensions = ${config.dimensions}
           AND candidate_embedding."imageMaxResolution" = ${config.imageMaxResolution}
           AND candidate_embedding.status = 'COMPLETE'::"EmbeddingStatus"
           AND candidate_embedding.embedding IS NOT NULL
          GROUP BY candidate.id
        `
      )
    );
    for (const rows of chunkRows) {
      for (const row of rows) {
        const postId = Number(row.postId);
        const similarity = Number(row.similarity);
        const current = similarities.get(postId);
        if (current === undefined || similarity > current) {
          similarities.set(postId, similarity);
        }
      }
    }
  }
  return similarities;
}


export interface EmbeddingPair {
  sourceId: number;
  candidateId: number;
}

/**
 * Exact raw cosine similarity for specific (source, candidate) post pairs
 * under the active config, keyed `${sourceId}:${candidateId}`.
 *
 * The feed's kNN fetch only reveals each seed's nearest `limit` posts; a
 * candidate reached through the tag channel that sits just outside that
 * window has a real, computable embedding similarity, and treating it as
 * unknown biases ranking by fetch depth rather than relevance. This computes
 * that similarity directly — no ANN index, one row per pair from two
 * primary-key lookups, so thousands of pairs cost milliseconds. Pairs where
 * either end has no COMPLETE embedding are absent from the result.
 */
export async function getEmbeddingSimilarityForPairs(options: {
  pairs: readonly EmbeddingPair[];
  config: EmbeddingConfig;
}): Promise<Map<string, number>> {
  const { config } = options;
  const bySeedPair = new Map<string, number>();
  if (options.pairs.length === 0) return bySeedPair;
  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const vectorTypeSql = vectorType(config.dimensions);
  const sourceIds = options.pairs.map((pair) => pair.sourceId);
  const candidateIds = options.pairs.map((pair) => pair.candidateId);

  const rows = await prisma.$queryRaw<
    { sourceId: number; candidateId: number; similarity: number }[]
  >`
    SELECT
      pair.source_id AS "sourceId",
      pair.candidate_id AS "candidateId",
      (1 - (se.embedding::${vectorTypeSql} <=> ce.embedding::${vectorTypeSql}))::float8 AS similarity
    FROM unnest(${sourceIds}::int[], ${candidateIds}::int[]) AS pair(source_id, candidate_id)
    JOIN "PostEmbedding" se
      ON se."postId" = pair.source_id
     AND se."baseUrl" = ${config.baseUrl}
     AND se.model = ${config.model}
     AND se.dimensions = ${config.dimensions}
     AND se."imageMaxResolution" = ${config.imageMaxResolution}
     AND se.status = 'COMPLETE'::"EmbeddingStatus"
     AND se.embedding IS NOT NULL
    JOIN "PostEmbedding" ce
      ON ce."postId" = pair.candidate_id
     AND ce."baseUrl" = ${config.baseUrl}
     AND ce.model = ${config.model}
     AND ce.dimensions = ${config.dimensions}
     AND ce."imageMaxResolution" = ${config.imageMaxResolution}
     AND ce.status = 'COMPLETE'::"EmbeddingStatus"
     AND ce.embedding IS NOT NULL
  `;

  for (const row of rows) {
    bySeedPair.set(`${row.sourceId}:${row.candidateId}`, Number(row.similarity));
  }
  return bySeedPair;
}

export async function findRelatedPostsByEmbeddingForPosts(options: {
  postIds: number[];
  config: EmbeddingConfig;
  limit: number;
  minScore?: number;
}): Promise<Map<number, EmbeddedRelatedPost[]>> {
  const { config } = options;
  const requestedLimit = Number.isFinite(options.limit) ? Math.floor(options.limit) : 10;
  const limit = Math.min(Math.max(1, requestedLimit), 20);

  if (!isSupportedEmbeddingDimensions(config.dimensions)) {
    throw new Error("Unsupported embedding dimensions for vector search");
  }

  const uniquePostIds = new Set<number>();
  for (const postId of options.postIds) {
    if (Number.isInteger(postId)) uniquePostIds.add(postId);
  }
  const postIds = [...uniquePostIds];
  const bySeed = new Map<number, EmbeddedRelatedPost[]>();
  if (postIds.length === 0) return bySeed;

  const vectorTypeSql = vectorType(config.dimensions);
  const minScore = normalizeEmbeddingMinScore(options.minScore);
  const maxDistance = minScore === null ? null : 1 - minScore;

  type ResultRow = {
    sourceId: number;
    id: number | null;
    hash: string | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string | null;
    distance: number | null;
  };

  const chunks: number[][] = [];
  for (let index = 0; index < postIds.length; index += RELATED_EMBEDDING_SEED_CHUNK_SIZE) {
    chunks.push(postIds.slice(index, index + RELATED_EMBEDDING_SEED_CHUNK_SIZE));
  }

  // A failed chunk REJECTS the whole call (after logging which seeds it
  // covered). Returning [] for it would silently drop those seeds'
  // neighborhoods, and the feed's stale-while-revalidate guard could then
  // cache a partial ranking as healthy; the feed marks the build degraded on
  // rejection instead and keeps serving its previous entry.
  const chunkRows = await Promise.all(
    chunks.map(async (chunk): Promise<ResultRow[]> => {
      try {
        return await prisma.$queryRaw<ResultRow[]>`
          WITH seed_embeddings AS (
            SELECT pe."postId" AS source_id, pe.embedding::${vectorTypeSql} AS embedding
            FROM "PostEmbedding" pe
            WHERE pe."postId" = ANY(${chunk}::int[])
              AND pe."baseUrl" = ${config.baseUrl}
              AND pe.model = ${config.model}
              AND pe.dimensions = ${config.dimensions}
              AND pe."imageMaxResolution" = ${config.imageMaxResolution}
              AND pe.status = 'COMPLETE'::"EmbeddingStatus"
              AND pe.embedding IS NOT NULL
          )
          SELECT
            seed.source_id AS "sourceId",
            related.id,
            related.hash,
            related.width,
            related.height,
            related.blurhash,
            related."mimeType",
            nearest.distance
          FROM seed_embeddings seed
          LEFT JOIN LATERAL (
            SELECT
              pe."postId",
              (pe.embedding::${vectorTypeSql} <=> seed.embedding)::float8 AS distance
            FROM "PostEmbedding" pe
            WHERE pe."baseUrl" = ${config.baseUrl}
              AND pe.model = ${config.model}
              AND pe.dimensions = ${config.dimensions}
              AND pe."imageMaxResolution" = ${config.imageMaxResolution}
              AND pe.status = 'COMPLETE'::"EmbeddingStatus"
              AND pe.embedding IS NOT NULL
              AND pe."postId" <> seed.source_id
              AND NOT EXISTS (
                SELECT 1
                FROM "PostGroup" source_group
                JOIN "PostGroup" related_group ON related_group."groupId" = source_group."groupId"
                WHERE source_group."postId" = seed.source_id
                  AND related_group."postId" = pe."postId"
              )
            ORDER BY pe.embedding::${vectorTypeSql} <=> seed.embedding
            LIMIT ${limit}
          ) nearest ON TRUE
          LEFT JOIN "Post" related ON related.id = nearest."postId"
          ORDER BY seed.source_id, nearest.distance
        `;
      } catch (error) {
        aiLog.error({ seeds: chunk.join(","), error: error instanceof Error ? error.message : String(error) }, "Embedding related-post chunk failed");
        throw error;
      }
    })
  );

  for (const rows of chunkRows) {
    for (const row of rows) {
      if (row.id === null || row.hash === null || row.mimeType === null || row.distance === null) {
        if (!bySeed.has(row.sourceId)) bySeed.set(row.sourceId, []);
        continue;
      }
      // Floor in JS (see normalizeEmbeddingMinScore) — never a SQL distance
      // predicate on the ANN scan. Keep the seed's (possibly empty) entry so
      // callers still see it as embedded.
      if (maxDistance !== null && Number(row.distance) > maxDistance) {
        if (!bySeed.has(row.sourceId)) bySeed.set(row.sourceId, []);
        continue;
      }

      const neighbors = bySeed.get(row.sourceId);
      const related = {
        id: row.id,
        hash: row.hash,
        width: row.width,
        height: row.height,
        blurhash: row.blurhash,
        mimeType: row.mimeType,
        distance: Number(row.distance),
        score: 1 - Number(row.distance),
      };
      if (neighbors) {
        neighbors.push(related);
      } else {
        bySeed.set(row.sourceId, [related]);
      }
    }
  }

  return bySeed;
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

  // Floor in JS (see normalizeEmbeddingMinScore) — never a SQL distance
  // predicate on the ANN scan.
  return rows
    .filter((row) => maxDistance === null || Number(row.distance) <= maxDistance)
    .map((row) => ({
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
    WHERE pe."baseUrl" = ${config.baseUrl}
      AND pe.model = ${config.model}
      AND pe.dimensions = ${config.dimensions}
      AND pe."imageMaxResolution" = ${config.imageMaxResolution}
      AND pe.status = ${status}::"EmbeddingStatus"
  `;

  return Number(rows[0]?.count ?? 0n);
}
