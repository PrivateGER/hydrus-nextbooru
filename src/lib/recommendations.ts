import { prisma } from "@/lib/db";

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface RecommendedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  score: number;
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
    take: limit,
  });

  // If cache exists and is fresh, return it
  if (cached.length > 0) {
    const cacheAge = Date.now() - cached[0].computedAt.getTime();
    if (cacheAge < CACHE_TTL_MS) {
      return cached.map((rec) => ({
        id: rec.recommended.id,
        hash: rec.recommended.hash,
        width: rec.recommended.width,
        height: rec.recommended.height,
        blurhash: rec.recommended.blurhash,
        mimeType: rec.recommended.mimeType,
        score: rec.score,
      }));
    }
  }

  // Compute fresh recommendations
  return computeAndCacheRecommendations(postId, limit);
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
export async function invalidateRecommendationsForPost(postId: number): Promise<void> {
  await prisma.postRecommendation.deleteMany({
    where: { postId },
  });
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
