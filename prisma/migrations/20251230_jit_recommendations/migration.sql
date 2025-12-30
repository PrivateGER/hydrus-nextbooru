-- Add computedAt column to PostRecommendation for cache TTL tracking
ALTER TABLE "PostRecommendation"
ADD COLUMN "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index for efficient cache freshness checks
CREATE INDEX "PostRecommendation_postId_computedAt_idx"
ON "PostRecommendation"("postId", "computedAt" DESC);

-- Remove batch pregen functions (no longer needed - using JIT)
DROP FUNCTION IF EXISTS pregen_all_recommendations(INTEGER);
DROP FUNCTION IF EXISTS pregen_all_recommendations_v2(INTEGER);

-- Update partial index: only tags on 2+ posts are useful for recommendations
DROP INDEX IF EXISTS "Tag_id_idfWeight_idx";
CREATE INDEX "Tag_id_idfWeight_idx" ON "Tag" (id, "idfWeight") WHERE "postCount" > 1;

-- Drop old compute function
DROP FUNCTION IF EXISTS compute_post_recommendations(INTEGER, INTEGER, INTEGER);

CREATE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL  -- kept for API compatibility, unused
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH source_tags AS (
    -- Fetch source post's tags with their IDF weights in one join
    -- Only include tags on 2+ posts (tags on 1 post can't match anything else)
    SELECT pt."tagId", t."idfWeight"
    FROM "PostTag" pt
    JOIN "Tag" t ON pt."tagId" = t.id
    WHERE pt."postId" = p_post_id
      AND t."postCount" > 1
  ),
  excluded_posts AS (
    -- Posts in the same group (to exclude from results)
    SELECT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  )
  SELECT
    pt."postId" AS recommended_id,
    SUM(st."idfWeight") AS score
  FROM source_tags st
  JOIN "PostTag" pt ON st."tagId" = pt."tagId"
  WHERE pt."postId" != p_post_id
    AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
  GROUP BY pt."postId"
  ORDER BY SUM(st."idfWeight") DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;
