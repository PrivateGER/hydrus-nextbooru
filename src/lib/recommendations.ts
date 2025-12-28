import { prisma } from "@/lib/db";
import { syncLog } from "@/lib/logger";

export interface RecommendationProgress {
  processed: number;
  total: number;
}

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
 * Pregenerate recommendations for all posts using the PL/pgSQL function.
 * This clears existing recommendations and computes new ones based on
 * IDF-weighted tag similarity.
 *
 * @param limit - Max recommendations per post (default: 10)
 * @param batchSize - Progress reporting interval (default: 100)
 * @returns Final progress with total processed count
 */
export async function pregenRecommendations(
  limit = 10,
  batchSize = 100
): Promise<RecommendationProgress> {
  syncLog.info({ limit, batchSize }, "Starting recommendation pregeneration");

  const startTime = Date.now();

  // Call the PL/pgSQL function - it returns progress rows periodically
  const results = await prisma.$queryRaw<RecommendationProgress[]>`
    SELECT * FROM pregen_all_recommendations(${limit}, ${batchSize})
  `;

  // Return the final result (last row)
  const finalResult = results[results.length - 1] || { processed: 0, total: 0 };

  const durationMs = Date.now() - startTime;
  syncLog.info(
    {
      processed: finalResult.processed,
      total: finalResult.total,
      durationMs,
    },
    "Recommendation pregeneration completed"
  );

  return finalResult;
}

/**
 * Get cached recommendations for a post.
 *
 * @param postId - The post ID to get recommendations for
 * @param limit - Max number of recommendations to return (default: 10)
 * @returns Array of recommended posts with similarity scores
 */
export async function getRecommendations(
  postId: number,
  limit = 10
): Promise<RecommendedPost[]> {
  const recommendations = await prisma.postRecommendation.findMany({
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

  return recommendations.map((rec) => ({
    id: rec.recommended.id,
    hash: rec.recommended.hash,
    width: rec.recommended.width,
    height: rec.recommended.height,
    blurhash: rec.recommended.blurhash,
    mimeType: rec.recommended.mimeType,
    score: rec.score,
  }));
}

/**
 * Get recommendations for a post by its hash.
 *
 * @param hash - The post hash to get recommendations for
 * @param limit - Max number of recommendations to return (default: 10)
 * @returns Array of recommended posts with similarity scores, or empty if post not found
 */
export async function getRecommendationsByHash(
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

  return getRecommendations(post.id, limit);
}

/**
 * Compute recommendations for a single post on-demand (not cached).
 * Useful for testing or when cached recommendations are stale.
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
 * Check if recommendations exist for any posts.
 * Useful to determine if pregeneration has been run.
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
    prisma.postRecommendation
      .groupBy({
        by: ["postId"],
        _count: true,
      })
      .then((groups) => groups.length),
  ]);

  return {
    totalRecommendations,
    postsWithRecommendations,
  };
}
