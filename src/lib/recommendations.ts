import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

interface RecommendedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  similarity: number;
  sharedTagCount: number;
}

/**
 * Get recommended posts based on tag similarity using Jaccard similarity coefficient.
 *
 * Algorithm:
 * - Uses Jaccard similarity: |A ∩ B| / |A ∪ B|
 *   where A = current post tags, B = candidate post tags
 * - **Only considers discriminating tags** (postCount ≤ 1000)
 *   - Filters out massive common tags like "1girl", "solo", "highres"
 *   - Improves both performance and recommendation quality
 * - Provides meaningful similarity scores (0.0 to 1.0)
 * - Filters out posts below minimum similarity threshold (0.15)
 * - Excludes perfect matches (similarity = 1.0) to prevent sets from dominating
 * - Excludes posts in the same groups (already shown in filmstrip)
 * - Returns up to 12 most similar posts, ordered by similarity
 *
 * Why Jaccard?
 * - Better than raw tag count: a post with 5/10 matching tags (0.5) ranks
 *   higher than one with 5/100 matching tags (0.05)
 * - Handles varying tag counts fairly
 * - Standard metric for set similarity
 *
 * Performance optimizations:
 * - Filters out high-frequency tags to avoid processing 50,000+ candidates
 * - Single SQL query with CTEs, joins and aggregation
 * - Uses existing indexes on PostTag(tagId), PostTag(postId), and Tag(postCount)
 * - Limits results to reduce data transfer
 *
 * @param postId - The ID of the current post
 * @param excludeGroupIds - Array of group IDs to exclude (posts already shown)
 * @returns Array of recommended posts with similarity scores
 */
export async function getRecommendedPosts(
  postId: number,
  excludeGroupIds: number[] = []
): Promise<RecommendedPost[]> {
  // First, get the tag count for the current post
  const currentPostTagCount = await prisma.postTag.count({
    where: { postId },
  });

  // If the post has no tags, return empty array
  if (currentPostTagCount === 0) {
    return [];
  }

  // Minimum similarity threshold (15% tag overlap)
  const MIN_SIMILARITY = 0.15;

  // Maximum tag frequency - exclude very common tags that don't discriminate well
  // Tags appearing on >1000 posts (e.g., "1girl", "solo", "highres") are filtered out
  // This improves both performance and recommendation quality
  const MAX_TAG_POST_COUNT = 1000;

  // Build the query to find similar posts using Jaccard similarity
  // Jaccard similarity = |A ∩ B| / |A ∪ B|
  //                    = shared_tags / (tags_A + tags_B - shared_tags)
  //
  // This query:
  // 1. Filters out very common tags (>1000 posts) for better discrimination
  // 2. Finds all posts that share at least one discriminating tag
  // 3. Calculates Jaccard similarity for each candidate
  // 4. Filters by minimum similarity threshold
  // 5. Excludes perfect matches (similarity = 1.0)
  // 6. Excludes posts in the same groups
  // 7. Orders by similarity (most similar first)
  // 8. Limits to 12 results
  const query = Prisma.sql`
    WITH current_post_tags AS (
      -- Get discriminating tag IDs (exclude very common tags)
      SELECT pt.tag_id
      FROM "PostTag" pt
      JOIN "Tag" t ON t.id = pt.tag_id
      WHERE pt.post_id = ${postId}
        AND t."postCount" <= ${MAX_TAG_POST_COUNT}
    ),
    candidate_posts AS (
      -- Find posts that share at least one tag and calculate metrics
      SELECT
        pt.post_id,
        COUNT(DISTINCT pt.tag_id) as shared_tag_count,
        -- Get total number of tags for each candidate
        (
          SELECT COUNT(*)
          FROM "PostTag" pt2
          WHERE pt2.post_id = pt.post_id
        ) as candidate_tag_count
      FROM "PostTag" pt
      WHERE pt.tag_id IN (SELECT tag_id FROM current_post_tags)
        AND pt.post_id != ${postId}
      GROUP BY pt.post_id
    ),
    scored_candidates AS (
      -- Calculate Jaccard similarity: intersection / union
      -- union = current_tags + candidate_tags - shared_tags
      SELECT
        cp.post_id,
        cp.shared_tag_count,
        cp.candidate_tag_count,
        -- Jaccard similarity coefficient
        CAST(cp.shared_tag_count AS FLOAT) /
        CAST((${currentPostTagCount} + cp.candidate_tag_count - cp.shared_tag_count) AS FLOAT) as similarity
      FROM candidate_posts cp
    ),
    filtered_candidates AS (
      -- Filter by similarity threshold and exclude perfect matches
      SELECT
        sc.post_id,
        sc.shared_tag_count,
        sc.similarity
      FROM scored_candidates sc
      WHERE sc.similarity >= ${MIN_SIMILARITY}
        AND sc.similarity < 1.0  -- Exclude perfect matches
        ${
          excludeGroupIds.length > 0
            ? Prisma.sql`
              -- Exclude posts in the same groups
              AND sc.post_id NOT IN (
                SELECT post_id
                FROM "PostGroup"
                WHERE group_id IN (${Prisma.join(excludeGroupIds)})
              )
            `
            : Prisma.empty
        }
    )
    -- Get post details
    SELECT
      p.id,
      p.hash,
      p.width,
      p.height,
      p."mimeType",
      fc.similarity,
      fc.shared_tag_count as "sharedTagCount"
    FROM filtered_candidates fc
    JOIN "Post" p ON p.id = fc.post_id
    ORDER BY fc.similarity DESC, fc.shared_tag_count DESC, p.id DESC
    LIMIT 12
  `;

  const results = await prisma.$queryRaw<RecommendedPost[]>(query);

  return results;
}
