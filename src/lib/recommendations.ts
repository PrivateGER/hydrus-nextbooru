import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

interface RecommendedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sharedTagCount: number;
}

/**
 * Get recommended posts based on tag similarity.
 *
 * Algorithm:
 * - Finds posts that share tags with the current post
 * - Scores by number of shared tags (more shared tags = higher relevance)
 * - Excludes posts with perfect tag overlap (prevents sets from dominating)
 * - Excludes posts in the same groups (already shown in filmstrip)
 * - Returns up to 12 most similar posts
 *
 * Performance optimizations:
 * - Single SQL query with joins and aggregation
 * - Uses existing indexes on PostTag(tagId) and PostTag(postId)
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

  // Build the query to find similar posts
  // This is a complex query that:
  // 1. Finds all posts that share at least one tag with the current post
  // 2. Counts how many tags they share (sharedTagCount)
  // 3. Excludes the current post
  // 4. Excludes posts in the same groups
  // 5. Excludes posts with perfect tag overlap (same total tags, all matching)
  // 6. Orders by shared tag count (most similar first)
  // 7. Limits to 12 results
  const query = Prisma.sql`
    WITH current_post_tags AS (
      -- Get all tag IDs for the current post
      SELECT tag_id
      FROM "PostTag"
      WHERE post_id = ${postId}
    ),
    candidate_posts AS (
      -- Find posts that share at least one tag
      SELECT
        pt.post_id,
        COUNT(DISTINCT pt.tag_id) as shared_tag_count,
        -- Also get the total number of tags each candidate has
        (
          SELECT COUNT(*)
          FROM "PostTag" pt2
          WHERE pt2.post_id = pt.post_id
        ) as total_tag_count
      FROM "PostTag" pt
      WHERE pt.tag_id IN (SELECT tag_id FROM current_post_tags)
        AND pt.post_id != ${postId}
      GROUP BY pt.post_id
    ),
    filtered_candidates AS (
      -- Exclude perfect overlaps: posts where shared_tag_count = total_tag_count = current post tag count
      -- This prevents sets of images with identical tags from filling all recommendations
      SELECT
        cp.post_id,
        cp.shared_tag_count
      FROM candidate_posts cp
      WHERE NOT (
        cp.shared_tag_count = ${currentPostTagCount}
        AND cp.total_tag_count = ${currentPostTagCount}
      )
      ${
        excludeGroupIds.length > 0
          ? Prisma.sql`
            -- Exclude posts in the same groups
            AND cp.post_id NOT IN (
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
      fc.shared_tag_count as "sharedTagCount"
    FROM filtered_candidates fc
    JOIN "Post" p ON p.id = fc.post_id
    ORDER BY fc.shared_tag_count DESC, p.id DESC
    LIMIT 12
  `;

  const results = await prisma.$queryRaw<RecommendedPost[]>(query);

  return results;
}
