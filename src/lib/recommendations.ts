import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_RECOMMENDATION_LIMIT = 20;

/**
 * Cap on how many of a source post's tags feed the similarity join. Kept in
 * sync with the p_max_source_tags default in the SQL functions. Only the least
 * distinctive (lowest-IDF) tags are dropped once a post exceeds this, so
 * ranking is preserved while the candidate scan stays bounded.
 */
const MAX_SOURCE_TAGS = 64;

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
 * compute_recommendations_for_posts, migration 20260707000000) and mirrored
 * here for discoverability — the two MUST stay in sync. See that migration for
 * the measured quality/scan tradeoff behind the 0.30 default.
 */
export const MAX_SOURCE_TAG_FREQUENCY = 0.3;

/**
 * Absolute floor paired with {@link MAX_SOURCE_TAG_FREQUENCY}: a tag is pruned
 * only when it is on more than both this many posts AND that fraction of the
 * corpus. Keeps the frequency prune dormant on small corpora.
 */
export const MIN_SOURCE_TAG_PRUNE_COUNT = 500;

export interface RecommendedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  score: number;
}

type RecommendationClient = Pick<typeof prisma, "postRecommendation">;

/**
 * In-flight computation coalescing map (single-process only).
 *
 * On a stale-cache miss, multiple concurrent requests for the SAME postId would
 * otherwise each run their own deleteMany+createMany. Even though each write is
 * wrapped in a transaction, running several of them back-to-back means a later
 * request can DELETE rows a concurrent reader is about to read, producing a
 * transient EMPTY-result window.
 *
 * Keying an in-flight promise by postId guarantees exactly one computation runs
 * at a time per postId; concurrent callers await the same promise. The entry is
 * always removed in a finally so a failed (rejected) computation never poisons
 * the key.
 *
 * This is a per-process Map: under a multi-worker / multi-replica deployment the
 * coalescing does NOT span processes (see the Deployment / Concurrency note in
 * CLAUDE.md). The DB writes remain transactional and safe regardless.
 */
const inFlightComputations = new Map<number, Promise<RecommendedPost[]>>();

function clampRecommendationLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(MAX_RECOMMENDATION_LIMIT, Math.max(1, Math.floor(limit)));
}

function mapRecommendation(rec: {
  recommended: {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
  };
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
 * - If cached recommendations exist and are fresh (< 24h), returns cached
 * - Otherwise, computes recommendations on-demand and caches them
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

  // Check for cached recommendations
  const cached = await prisma.postRecommendation.findMany({
    where: { postId },
    include: {
      recommended: {
        select: {
          id: true,
          hash: true,
          width: true,
          height: true,
          blurhash: true,
          mimeType: true,
        },
      },
    },
    orderBy: { score: "desc" },
    take: MAX_RECOMMENDATION_LIMIT,
  });

  // If cache exists and is fresh, return it
  if (cached.length > 0) {
    const computedAt = cached[0].computedAt;
    // Treat missing computedAt as stale (pre-migration data)
    if (computedAt) {
      const cacheAge = Date.now() - computedAt.getTime();
      if (cacheAge < CACHE_TTL_MS) {
        return cached.map(mapRecommendation).slice(0, clampedLimit);
      }
    }
  }

  // Compute fresh recommendations.
  // Coalesce concurrent computations for the same postId onto a single
  // in-flight promise so only one delete+insert runs, eliminating the
  // transient empty-result window during recomputation.
  let inFlight = inFlightComputations.get(postId);
  if (!inFlight) {
    inFlight = computeAndCacheRecommendations(postId, MAX_RECOMMENDATION_LIMIT).finally(() => {
      // Always clean up, on success AND on error, so a failed computation
      // does not poison this key forever.
      inFlightComputations.delete(postId);
    });
    inFlightComputations.set(postId, inFlight);
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
 * Compute recommendations for a post and cache them.
 */
async function computeAndCacheRecommendations(
  postId: number,
  limit: number
): Promise<RecommendedPost[]> {
  // Call the SQL function to compute recommendations
  const rawResults = await prisma.$queryRaw<
    { recommended_id: number; score: number }[]
  >`SELECT * FROM compute_post_recommendations(${postId}, ${limit})`;

  if (rawResults.length === 0) {
    // Delete any stale cache entries
    await prisma.postRecommendation.deleteMany({ where: { postId } });
    return [];
  }

  const recommendedIds = rawResults.map((r) => r.recommended_id);

  // Fetch post details for the recommended IDs
  const posts = await prisma.post.findMany({
    where: { id: { in: recommendedIds } },
    select: {
      id: true,
      hash: true,
      width: true,
      height: true,
      blurhash: true,
      mimeType: true,
    },
  });

  const postMap = new Map(posts.map((p) => [p.id, p]));
  const now = new Date();

  // Upsert recommendations in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete old recommendations for this post
    await tx.postRecommendation.deleteMany({ where: { postId } });

    // Insert new recommendations
    await tx.postRecommendation.createMany({
      data: rawResults.map((r) => ({
        postId,
        recommendedId: r.recommended_id,
        score: r.score,
        computedAt: now,
      })),
      // Concurrent requests may compute the same rows; ignore duplicates.
      skipDuplicates: true,
    });
  });

  // Return results in score order
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
 * This reuses the same 24h {@link PostRecommendation} cache, but computes every
 * cold seed in ONE set-based `compute_recommendations_for_posts` call (one scan
 * of PostTag instead of N). Fresh cache hits are served from the read; only the
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

  // 1. Read whatever is cached for these seeds in one indexed query.
  const cachedRows = await prisma.postRecommendation.findMany({
    where: { postId: { in: uniqueIds } },
    include: {
      recommended: {
        select: {
          id: true,
          hash: true,
          width: true,
          height: true,
          blurhash: true,
          mimeType: true,
        },
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

  const now = Date.now();
  const coldIds: number[] = [];
  for (const id of uniqueIds) {
    const rows = cachedBySeed.get(id);
    // Fresh iff we have rows and the newest is within the TTL. Absence of rows
    // is ambiguous (never computed vs. genuinely empty), so — like the single-
    // post path — we recompute rather than negative-cache.
    const computedAt = rows?.[0]?.computedAt;
    if (rows && computedAt && now - computedAt.getTime() < CACHE_TTL_MS) {
      result.set(id, rows.map(mapRecommendation).slice(0, clampedLimit));
    } else {
      coldIds.push(id);
    }
  }

  if (coldIds.length === 0) return result;

  // 2. Compute every cold seed in a single set-based query.
  const idsLiteral = Prisma.raw(
    `ARRAY[${coldIds.map((id) => Math.trunc(id)).join(",")}]::integer[]`
  );
  const rawResults = await prisma.$queryRaw<
    { source_id: number; recommended_id: number; score: number }[]
  >`SELECT * FROM compute_recommendations_for_posts(${idsLiteral}, ${MAX_RECOMMENDATION_LIMIT}::int, ${MAX_SOURCE_TAGS}::int)`;

  // 3. Fetch post details for every recommended id in one query.
  const recommendedIds = [...new Set(rawResults.map((r) => r.recommended_id))];
  const posts =
    recommendedIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: recommendedIds } },
          select: {
            id: true,
            hash: true,
            width: true,
            height: true,
            blurhash: true,
            mimeType: true,
          },
        })
      : [];
  const postMap = new Map(posts.map((p) => [p.id, p]));

  // 4. Persist the freshly computed rows so single-post lookups stay warm.
  //    Interactive transaction (checked-out client) keeps the delete+insert
  //    atomic per the existing single-post pattern.
  const computedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.postRecommendation.deleteMany({ where: { postId: { in: coldIds } } });
    if (rawResults.length > 0) {
      await tx.postRecommendation.createMany({
        data: rawResults.map((r) => ({
          postId: r.source_id,
          recommendedId: r.recommended_id,
          score: r.score,
          computedAt,
        })),
        skipDuplicates: true,
      });
    }
  });

  // 5. Assemble per-seed results (score desc). Every cold seed gets an entry,
  //    empty when it had no neighbors.
  const freshBySeed = new Map<number, RecommendedPost[]>();
  for (const r of rawResults) {
    const post = postMap.get(r.recommended_id);
    if (!post) continue;
    const bucket = freshBySeed.get(r.source_id);
    const entry: RecommendedPost = {
      id: post.id,
      hash: post.hash,
      width: post.width,
      height: post.height,
      blurhash: post.blurhash,
      mimeType: post.mimeType,
      score: r.score,
    };
    if (bucket) bucket.push(entry);
    else freshBySeed.set(r.source_id, [entry]);
  }
  for (const id of coldIds) {
    const neighbors = (freshBySeed.get(id) ?? [])
      .sort((a, b) => b.score - a.score)
      .slice(0, clampedLimit);
    result.set(id, neighbors);
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
 */
export async function invalidateRecommendationsForPost(
  postId: number,
  client: RecommendationClient = prisma
): Promise<void> {
  await client.postRecommendation.deleteMany({
    where: {
      OR: [
        { postId },
        { recommendedId: postId },
      ],
    },
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
