CREATE TABLE "PostRecommendation" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "recommendedId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PostRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostRecommendation_postId_idx" ON "PostRecommendation"("postId");
CREATE INDEX "PostRecommendation_recommendedId_idx" ON "PostRecommendation"("recommendedId");

CREATE UNIQUE INDEX "PostRecommendation_postId_recommendedId_key" ON "PostRecommendation"("postId", "recommendedId");

ALTER TABLE "PostRecommendation" ADD CONSTRAINT "PostRecommendation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostRecommendation" ADD CONSTRAINT "PostRecommendation_recommendedId_fkey" FOREIGN KEY ("recommendedId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PL/pgSQL function to compute recommendations for a single post
-- Uses IDF-weighted tag similarity, excludes posts in same groups
-- p_total_posts: Optional - pass total post count to avoid redundant COUNT(*) in batch processing
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
DECLARE
  v_total_posts INTEGER;
BEGIN
  -- Use provided total or calculate it
  v_total_posts := COALESCE(p_total_posts, (SELECT COUNT(*) FROM "Post"));

  -- Early exit if no posts exist
  IF v_total_posts = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH post_tags AS (
    SELECT "tagId" FROM "PostTag" WHERE "postId" = p_post_id
  ),
  tag_weights AS (
    -- Use GREATEST to prevent negative weights from stale postCount data
    SELECT t.id, GREATEST(0, LN(v_total_posts::FLOAT / t."postCount")) AS weight
    FROM "Tag" t
    JOIN post_tags pt ON t.id = pt."tagId"
    WHERE t."postCount" > 0
  ),
  same_group_posts AS (
    SELECT DISTINCT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  ),
  candidates AS (
    SELECT pt."postId", SUM(tw.weight) AS score
    FROM "PostTag" pt
    JOIN tag_weights tw ON pt."tagId" = tw.id
    WHERE pt."postId" != p_post_id
      AND NOT EXISTS (
        SELECT 1 FROM same_group_posts sgp WHERE sgp."postId" = pt."postId"
      )
    GROUP BY pt."postId"
    ORDER BY SUM(tw.weight) DESC
    LIMIT p_limit
  )
  SELECT c."postId", c.score FROM candidates c;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- PL/pgSQL function to pregenerate recommendations for all posts
-- Uses set-based LATERAL join for parallelizable execution
CREATE OR REPLACE FUNCTION pregen_all_recommendations(
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  processed BIGINT,
  total BIGINT
) AS $$
DECLARE
  v_total INTEGER;
  v_inserted BIGINT;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_total FROM "Post";

  DELETE FROM "PostRecommendation";

  -- Insert all recommendations in one set-based operation using LATERAL
  -- Pass v_total to avoid redundant COUNT(*) per post
  INSERT INTO "PostRecommendation" ("postId", "recommendedId", score)
  SELECT p.id, rec.recommended_id, rec.score
  FROM "Post" p
  CROSS JOIN LATERAL compute_post_recommendations(p.id, p_limit, v_total) rec;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Return stats: processed = recommendations inserted, total = posts processed
  processed := v_inserted;
  total := v_total;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql VOLATILE;
