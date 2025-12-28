-- CreateTable
CREATE TABLE "PostRecommendation" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "recommendedId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PostRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostRecommendation_postId_idx" ON "PostRecommendation"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRecommendation_postId_recommendedId_key" ON "PostRecommendation"("postId", "recommendedId");

-- AddForeignKey
ALTER TABLE "PostRecommendation" ADD CONSTRAINT "PostRecommendation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRecommendation" ADD CONSTRAINT "PostRecommendation_recommendedId_fkey" FOREIGN KEY ("recommendedId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create PL/pgSQL function to compute recommendations for a single post
-- Uses IDF-weighted tag similarity, excludes posts in same groups
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
DECLARE
  v_total_posts INTEGER;
BEGIN
  -- Get total post count for IDF calculation
  SELECT COUNT(*) INTO v_total_posts FROM "Post";

  RETURN QUERY
  WITH post_tags AS (
    SELECT "tagId" FROM "PostTag" WHERE "postId" = p_post_id
  ),
  tag_weights AS (
    SELECT t.id, LN(v_total_posts::FLOAT / NULLIF(t."postCount", 0)) AS weight
    FROM "Tag" t
    WHERE t.id IN (SELECT "tagId" FROM post_tags)
      AND t."postCount" > 0
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
      AND pt."postId" NOT IN (SELECT "postId" FROM same_group_posts)
    GROUP BY pt."postId"
    ORDER BY SUM(tw.weight) DESC
    LIMIT p_limit
  )
  SELECT c."postId", c.score FROM candidates c;
END;
$$ LANGUAGE plpgsql PARALLEL SAFE;

-- Create PL/pgSQL function to pregenerate recommendations for all posts
-- Processes in batches and returns progress
CREATE OR REPLACE FUNCTION pregen_all_recommendations(
  p_limit INTEGER DEFAULT 10,
  p_batch_size INTEGER DEFAULT 100
) RETURNS TABLE (
  processed INTEGER,
  total INTEGER
) AS $$
DECLARE
  v_total INTEGER;
  v_processed INTEGER := 0;
  v_post_id INTEGER;
  v_cursor CURSOR FOR SELECT id FROM "Post" ORDER BY id;
BEGIN
  SELECT COUNT(*) INTO v_total FROM "Post";

  -- Clear existing recommendations
  DELETE FROM "PostRecommendation";

  -- Process posts one by one
  OPEN v_cursor;
  LOOP
    FETCH v_cursor INTO v_post_id;
    EXIT WHEN NOT FOUND;

    -- Insert recommendations for this post
    INSERT INTO "PostRecommendation" ("postId", "recommendedId", score)
    SELECT v_post_id, recommended_id, cpr.score
    FROM compute_post_recommendations(v_post_id, p_limit) cpr;

    v_processed := v_processed + 1;

    -- Yield progress periodically
    IF v_processed % p_batch_size = 0 THEN
      processed := v_processed;
      total := v_total;
      RETURN NEXT;
    END IF;
  END LOOP;
  CLOSE v_cursor;

  -- Final result
  processed := v_processed;
  total := v_total;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
