import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { postCardSelect } from "@/lib/post-select";
import type { PostSummary } from "@/types/post";

export const MAX_RECOMMENDATION_LIMIT = 20;
export const TAG_STATS_GENERATION_SETTINGS_KEY = "recommendations.tagStatsGeneration";

/**
 * Cap on how many of a source post's retained tags feed the final cosine
 * rerank. Kept in sync with the p_max_source_tags default in the batch SQL
 * function and the hardcoded scoring cap in the single-post function.
 */
const MAX_SOURCE_TAGS = 64;

/**
 * Phase-1 retrieval cap: candidates are discovered from the source's top 16
 * retained tags, ranked by an approximate cosine (partial dot over these tags
 * divided by the candidate's exact precomputed tagIdfNorm), then the best
 * {@link SOURCE_TAG_RERANK_CANDIDATES} candidates are reranked by the full
 * {@link MAX_SOURCE_TAGS} scoring set. Top-16 keeps phase-1 scan volume
 * bounded (~1.76M rows for 109 seeds versus ~57M for the set-based K=64
 * scan); the norm-aware ordering stops high-tag-count hub posts from crowding
 * the rerank cutoff (migration 20260722150000: 17/24 -> 23/24 sampled prod
 * seeds with perfect overlap@10 against the exact K=64 cosine).
 */
export const SOURCE_TAG_RETRIEVAL_CAP = 16;

/**
 * Number of phase-1 candidates kept per source for exact top-64 cosine rerank.
 * Hardcoded in migration 20260722150000_normed_phase1_retrieval.
 */
export const SOURCE_TAG_RERANK_CANDIDATES = 800;

/**
 * Distinctiveness floor: a source tag present on more than this FRACTION of the
 * corpus is dropped from the similarity match before the candidate scan. Such
 * near-ubiquitous tags carry ~0 IDF (they contribute almost nothing to the
 * score) but have the largest posting lists, so dropping them preserves ranking
 * while bounding the scan to a fraction of the table.
 * A tag must also exceed {@link MIN_SOURCE_TAG_PRUNE_COUNT} posts in absolute
 * terms to be pruned, so small libraries (where a tag can sit on a large
 * fraction of few posts without being "massively shared") are left untouched.
 *
 * Both are HARDCODED in the SQL functions (compute_post_recommendations /
 * compute_recommendations_for_posts, latest definition in migration
 * 20260722150000_normed_phase1_retrieval) and mirrored here for
 * discoverability — the two MUST stay in sync. See migration 20260707000000
 * for the measured quality/scan tradeoff behind the 0.30 default.
 */
export const MAX_SOURCE_TAG_FREQUENCY = 0.3;

/**
 * Absolute floor paired with {@link MAX_SOURCE_TAG_FREQUENCY}: a tag is pruned
 * only when it is on more than both this many posts AND that fraction of the
 * corpus. Keeps the frequency prune dormant on small corpora.
 */
export const MIN_SOURCE_TAG_PRUNE_COUNT = 500;

export interface RecommendedPost extends PostSummary {
  id: number;
  /**
   * IDF-weighted tag cosine similarity in [0, 1]; 1 = tag-identical posts.
   * Comparable across source posts (see migration 20260707120000).
   */
  score: number;
}

type RecommendationClient = Pick<typeof prisma, "postRecommendation">;
type RecommendationGenerationClient = Pick<typeof prisma, "settings" | "$executeRaw">;

/**
 * In-flight computation coalescing map (single-process only).
 *
 * A stale-generation cache miss can otherwise make multiple concurrent requests
 * for the same postId each run deleteMany+createMany. A later writer could erase
 * rows a concurrent reader is about to read, producing a transient empty result.
 *
 * Keying an in-flight promise by postId guarantees one computation at a time per
 * postId; concurrent callers await it. The entry is always removed in finally
 * so a rejected computation never poisons the key.
 *
 * This is a per-process Map: under multi-worker / multi-replica deployment the
 * coalescing does NOT span processes. The durable tag-statistics generation
 * fence still prevents an older computation from persisting stale scores.
 *
 * Keys are `${generation}:${postId}`: a caller that already read generation
 * G+1 must not join a computation started under G — its result is stale for
 * that caller even though the fence stops it from being persisted.
 */
const inFlightComputations = new Map<string, Promise<RecommendedPost[]>>();

function inFlightKey(generation: number, postId: number): string {
  return `${generation}:${postId}`;
}

function clampRecommendationLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(MAX_RECOMMENDATION_LIMIT, Math.max(1, Math.floor(limit)));
}

/**
 * Read the durable tag-statistics generation. Missing or corrupted settings
 * fall back to the initial generation.
 */
export async function readTagStatsGeneration(
  client: RecommendationGenerationClient = prisma
): Promise<number> {
  const row = await client.settings.findUnique({
    where: { key: TAG_STATS_GENERATION_SETTINGS_KEY },
    select: { value: true },
  });
  const generation = row ? Number(row.value) : 0;
  return Number.isSafeInteger(generation) && generation >= 0 ? generation : 0;
}

/**
 * Read and share-lock the generation row until the surrounding transaction
 * commits, preventing a bump from interleaving with this cache write. A missing
 * row behaves as generation zero; a concurrent first bump leaves any newer rows
 * protected by the generation-qualified delete.
 */
async function readTagStatsGenerationForShare(
  client: Pick<typeof prisma, "$queryRaw">
): Promise<number> {
  const rows = await client.$queryRaw<{ value: string }[]>`
    SELECT "value" FROM "Settings"
    WHERE "key" = ${TAG_STATS_GENERATION_SETTINGS_KEY}
    FOR SHARE
  `;
  const generation = rows[0] ? Number(rows[0].value) : 0;
  return Number.isSafeInteger(generation) && generation >= 0 ? generation : 0;
}

/**
 * Advance the durable tag-statistics generation with one atomic upsert.
 * A corrupted stored value heals to the first invalidated generation.
 */
export async function bumpTagStatsGeneration(
  client: RecommendationGenerationClient = prisma
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO "Settings" ("key", "value", "updatedAt")
    VALUES (${TAG_STATS_GENERATION_SETTINGS_KEY}, '1', NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" =
        (CASE WHEN "Settings"."value" ~ '^[0-9]+$'
              THEN "Settings"."value"::bigint + 1
              ELSE 1 END)::text,
      "updatedAt" = NOW()
  `;
}

function mapRecommendation(rec: {
  recommended: PostSummary & { id: number };
  score: number;
}): RecommendedPost {
  return {
    id: rec.recommended.id,
    hash: rec.recommended.hash,
    width: rec.recommended.width,
    height: rec.recommended.height,
    blurhash: rec.recommended.blurhash,
    mimeType: rec.recommended.mimeType,
    score: rec.score,
  };
}

/**
 * Get or compute recommendations for a post (JIT with caching).
 *
 * - If cached recommendations match the current tag-statistics generation, returns cached
 * - Otherwise, computes recommendations on-demand and caches them when the generation holds
 *
 * @param postId - The post ID to get recommendations for
 * @param limit - Max number of recommendations to return (default: 10)
 * @returns Array of recommended posts with similarity scores
 */
export async function getOrComputeRecommendations(
  postId: number,
  limit = 10
): Promise<RecommendedPost[]> {
  const clampedLimit = clampRecommendationLimit(limit);
  const generation = await readTagStatsGeneration();

  // Check for cached recommendations
  const cached = await prisma.postRecommendation.findMany({
    where: { postId },
    include: {
      recommended: {
        select: postCardSelect,
      },
    },
    orderBy: { score: "desc" },
    take: MAX_RECOMMENDATION_LIMIT,
  });

  if (cached.length > 0 && cached.every((row) => row.generation === generation)) {
    return cached.map(mapRecommendation).slice(0, clampedLimit);
  }

  // Coalesce concurrent computations for the same postId onto a single
  // in-flight promise so only one delete+insert runs, eliminating the
  // transient empty-result window during recomputation.
  const key = inFlightKey(generation, postId);
  let inFlight = inFlightComputations.get(key);
  if (!inFlight) {
    inFlight = computeAndCacheRecommendations(
      postId,
      MAX_RECOMMENDATION_LIMIT,
      generation
    ).finally(() => {
      // Always clean up, on success AND on error, so a failed computation
      // does not poison this key forever.
      inFlightComputations.delete(key);
    });
    inFlightComputations.set(key, inFlight);
  }

  const fresh = await inFlight;
  return fresh.slice(0, clampedLimit);
}

/**
 * Get or compute recommendations for a post by its hash (JIT with caching).
 *
 * @param hash - The post hash to get recommendations for
 * @param limit - Max number of recommendations to return (default: 10)
 * @returns Array of recommended posts with similarity scores, or empty if post not found
 */
export async function getOrComputeRecommendationsByHash(
  hash: string,
  limit = 10
): Promise<RecommendedPost[]> {
  const post = await prisma.post.findUnique({
    where: { hash },
    select: { id: true },
  });

  if (!post) {
    return [];
  }

  return getOrComputeRecommendations(post.id, limit);
}

/**
 * Compute recommendations for a post and cache them if tag statistics did not
 * change while the SQL function was running.
 */
async function computeAndCacheRecommendations(
  postId: number,
  limit: number,
  generation: number
): Promise<RecommendedPost[]> {
  const rawResults = await prisma.$queryRaw<
    { recommended_id: number; score: number }[]
  >`SELECT * FROM compute_post_recommendations(${postId}, ${limit})`;

  const recommendedIds = rawResults.map((r) => r.recommended_id);
  const posts =
    recommendedIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: recommendedIds } },
          select: postCardSelect,
        })
      : [];
  const postMap = new Map(posts.map((p) => [p.id, p]));

  // The transaction holds a shared lock on the generation row while it writes,
  // so a bump cannot interleave after this check. A newer generation's rows are
  // never deleted; if one exists, skipDuplicates lets it win per unique pair.
  await prisma.$transaction(async (tx) => {
    if ((await readTagStatsGenerationForShare(tx)) !== generation) return;

    const now = new Date();
    await tx.postRecommendation.deleteMany({
      where: { postId, generation: { lte: generation } },
    });
    if (rawResults.length > 0) {
      await tx.postRecommendation.createMany({
        data: rawResults.map((r) => ({
          postId,
          recommendedId: r.recommended_id,
          score: r.score,
          computedAt: now,
          generation,
        })),
        skipDuplicates: true,
      });
    }
  });

  return rawResults
    .map((r) => {
      const post = postMap.get(r.recommended_id);
      if (!post) return null;
      return {
        id: post.id,
        hash: post.hash,
        width: post.width,
        height: post.height,
        blurhash: post.blurhash,
        mimeType: post.mimeType,
        score: r.score,
      };
    })
    .filter((p): p is RecommendedPost => p !== null);
}

/**
 * Batched tag-similarity neighborhoods for many source posts at once.
 *
 * The "For You" feed seeds from dozens of posts (favorites, recently viewed,
 * dismissals). Calling {@link getOrComputeRecommendations} once per seed fanned
 * out into N cold `compute_post_recommendations` calls, each spinning up
 * parallel workers — the batch that pegged the DB at 100% CPU on a cold cache.
 *
 * This reuses the generation-fenced {@link PostRecommendation} cache, but
 * computes every cold seed in ONE `compute_recommendations_for_posts` call. The
 * SQL function uses a LATERAL-per-seed shape: each seed prunes to its retained
 * top tags before scanning candidate posting lists, avoiding the old cross-seed
 * GroupAggregate blow-up. Fresh cache hits are served from the read; only the
 * misses hit the compute. Newly computed rows are persisted so a later
 * single-post lookup (detail page) is warm too.
 *
 * A seed with no fresh cached rows is treated as cold — mirroring the single-
 * post path, which never negative-caches an empty result.
 *
 * @param seedIds - source post ids (deduped internally)
 * @param limit - max neighbors returned per seed (cache always stores the top
 *   {@link MAX_RECOMMENDATION_LIMIT})
 * @returns Map from seed id to its ranked neighbors (score desc). Seeds with no
 *   neighbors map to an empty array.
 */
export async function getTagNeighborhoodsForSeeds(
  seedIds: number[],
  limit = MAX_RECOMMENDATION_LIMIT
): Promise<Map<number, RecommendedPost[]>> {
  const clampedLimit = clampRecommendationLimit(limit);
  const result = new Map<number, RecommendedPost[]>();
  const uniqueIds = [...new Set(seedIds.filter((id) => Number.isInteger(id)))];
  if (uniqueIds.length === 0) return result;

  const generation = await readTagStatsGeneration();
  const cachedRows = await prisma.postRecommendation.findMany({
    where: { postId: { in: uniqueIds } },
    include: {
      recommended: {
        select: postCardSelect,
      },
    },
    orderBy: { score: "desc" },
  });

  const cachedBySeed = new Map<number, typeof cachedRows>();
  for (const row of cachedRows) {
    const bucket = cachedBySeed.get(row.postId);
    if (bucket) bucket.push(row);
    else cachedBySeed.set(row.postId, [row]);
  }

  const coldIds: number[] = [];
  for (const id of uniqueIds) {
    const rows = cachedBySeed.get(id);
    // Absence is ambiguous (never computed vs. genuinely empty), so — like the
    // single-post path — it recomputes rather than negative-caching.
    if (rows && rows.every((row) => row.generation === generation)) {
      result.set(id, rows.map(mapRecommendation).slice(0, clampedLimit));
    } else {
      coldIds.push(id);
    }
  }

  if (coldIds.length === 0) return result;

  // A single-post request may have started after this request read its cache.
  // Join its work instead of racing its delete+insert; batch-only cold seeds
  // remain together in one SQL call.
  const inFlightById = new Map<number, Promise<RecommendedPost[]>>();
  const idsToCompute: number[] = [];
  for (const id of coldIds) {
    const inFlight = inFlightComputations.get(inFlightKey(generation, id));
    if (inFlight) inFlightById.set(id, inFlight);
    else idsToCompute.push(id);
  }

  if (idsToCompute.length > 0) {
    const batchPromise = (async (): Promise<Map<number, RecommendedPost[]>> => {
      const idsLiteral = Prisma.raw(
        `ARRAY[${idsToCompute.map((id) => Math.trunc(id)).join(",")}]::integer[]`
      );
      const rawResults = await prisma.$queryRaw<
        { source_id: number; recommended_id: number; score: number }[]
      >`SELECT * FROM compute_recommendations_for_posts(${idsLiteral}, ${MAX_RECOMMENDATION_LIMIT}::int, ${MAX_SOURCE_TAGS}::int)`;

      const recommendedIds = [...new Set(rawResults.map((row) => row.recommended_id))];
      const posts =
        recommendedIds.length > 0
          ? await prisma.post.findMany({
              where: { id: { in: recommendedIds } },
              select: postCardSelect,
            })
          : [];
      const postMap = new Map(posts.map((post) => [post.id, post]));
      const freshBySeed = new Map<number, RecommendedPost[]>();

      for (const row of rawResults) {
        const post = postMap.get(row.recommended_id);
        if (!post) continue;
        const entry: RecommendedPost = {
          id: post.id,
          hash: post.hash,
          width: post.width,
          height: post.height,
          blurhash: post.blurhash,
          mimeType: post.mimeType,
          score: row.score,
        };
        const neighbors = freshBySeed.get(row.source_id);
        if (neighbors) neighbors.push(entry);
        else freshBySeed.set(row.source_id, [entry]);
      }

      for (const id of idsToCompute) {
        const neighbors = freshBySeed.get(id) ?? [];
        neighbors.sort((left, right) => right.score - left.score);
        freshBySeed.set(id, neighbors.slice(0, MAX_RECOMMENDATION_LIMIT));
      }

      // A shared lock holds the observed generation through the write. Rows
      // from an even newer generation are preserved by the qualified delete.
      await prisma.$transaction(async (tx) => {
        if ((await readTagStatsGenerationForShare(tx)) !== generation) return;

        const computedAt = new Date();
        await tx.postRecommendation.deleteMany({
          where: {
            postId: { in: idsToCompute },
            generation: { lte: generation },
          },
        });
        if (rawResults.length > 0) {
          await tx.postRecommendation.createMany({
            data: rawResults.map((row) => ({
              postId: row.source_id,
              recommendedId: row.recommended_id,
              score: row.score,
              computedAt,
              generation,
            })),
            skipDuplicates: true,
          });
        }
      });

      return freshBySeed;
    })();

    for (const id of idsToCompute) {
      const key = inFlightKey(generation, id);
      const inFlight: Promise<RecommendedPost[]> = batchPromise
        .then((freshBySeed) => freshBySeed.get(id) ?? [])
        .finally(() => {
          if (inFlightComputations.get(key) === inFlight) {
            inFlightComputations.delete(key);
          }
        });
      inFlightComputations.set(key, inFlight);
      inFlightById.set(id, inFlight);
    }
  }

  const inFlightIds = [...inFlightById.keys()];
  const inFlightResults = await Promise.all(inFlightById.values());
  for (const [index, id] of inFlightIds.entries()) {
    result.set(id, inFlightResults[index].slice(0, clampedLimit));
  }

  return result;
}

/**
 * Compute recommendations for a single post on-demand (not cached).
 * Useful for testing or benchmarking.
 *
 * @param postId - The post ID to compute recommendations for
 * @param limit - Max recommendations to return (default: 10)
 * @returns Array of recommended post IDs with scores
 */
export async function computeRecommendationsForPost(
  postId: number,
  limit = 10
): Promise<{ recommendedId: number; score: number }[]> {
  return prisma.$queryRaw<{ recommended_id: number; score: number }[]>`
    SELECT * FROM compute_post_recommendations(${postId}, ${limit})
  `.then((rows) =>
    rows.map((row) => ({
      recommendedId: row.recommended_id,
      score: row.score,
    }))
  );
}

/**
 * Invalidate cached recommendations for a specific post.
 * Call this when a post's tags change significantly.
 *
 * Every source that recommended the changed post is invalidated as a whole:
 * its remaining rows were scored against the same old source statistics.
 */
export async function invalidateRecommendationsForPost(
  postId: number,
  client: RecommendationClient = prisma
): Promise<void> {
  const affectedSources = await client.postRecommendation.findMany({
    where: { recommendedId: postId },
    distinct: ["postId"],
    select: { postId: true },
  });
  const sourceIds = [postId, ...affectedSources.map((source) => source.postId)];

  await client.postRecommendation.deleteMany({
    where: { postId: { in: sourceIds } },
  });
}

/**
 * Invalidate all cached recommendations.
 * Call this after global IDF/tag stats refreshes.
 */
export async function invalidateAllRecommendations(
  client: RecommendationClient = prisma
): Promise<void> {
  await client.postRecommendation.deleteMany();
}

/**
 * Check if recommendations exist for any posts.
 */
export async function hasRecommendations(): Promise<boolean> {
  const count = await prisma.postRecommendation.count({ take: 1 });
  return count > 0;
}

/**
 * Get recommendation statistics.
 */
export async function getRecommendationStats(): Promise<{
  totalRecommendations: number;
  postsWithRecommendations: number;
}> {
  const [totalRecommendations, postsWithRecommendations] = await Promise.all([
    prisma.postRecommendation.count(),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "postId") as count FROM "PostRecommendation"
    `.then(([result]) => Number(result.count)),
  ]);

  return {
    totalRecommendations,
    postsWithRecommendations,
  };
}
