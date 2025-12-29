-- Add idfWeight column to Tag table for pre-computed IDF weights
ALTER TABLE "Tag" ADD COLUMN "idfWeight" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Index for efficient tag weight lookups in recommendation queries
CREATE INDEX "Tag_id_idfWeight_idx" ON "Tag" (id, "idfWeight") WHERE "postCount" > 0;

-- Update compute_post_recommendations to use pre-computed idfWeight
-- Note: We include all tags with postCount > 0, even those with idfWeight = 0
-- (tags appearing on all posts have LN(1) = 0 but should still be counted)
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH post_tags AS (
    SELECT "tagId" FROM "PostTag" WHERE "postId" = p_post_id
  ),
  same_group_posts AS (
    SELECT DISTINCT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  ),
  candidates AS (
    SELECT pt."postId", SUM(t."idfWeight") AS score
    FROM "PostTag" pt
    JOIN "Tag" t ON pt."tagId" = t.id
    WHERE pt."tagId" IN (SELECT "tagId" FROM post_tags)
      AND pt."postId" != p_post_id
      AND t."postCount" > 0
      AND NOT EXISTS (
        SELECT 1 FROM same_group_posts sgp WHERE sgp."postId" = pt."postId"
      )
    GROUP BY pt."postId"
    ORDER BY SUM(t."idfWeight") DESC
    LIMIT p_limit
  )
  SELECT c."postId", c.score FROM candidates c;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Optimized set-based recommendation generation
-- Computes ALL similarities in one query instead of per-post LATERAL calls
CREATE OR REPLACE FUNCTION pregen_all_recommendations_v2(
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

  -- Early exit if no posts
  IF v_total = 0 THEN
    processed := 0;
    total := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Clear existing recommendations
  DELETE FROM "PostRecommendation";

  -- Pre-compute same-group pairs for exclusion (both directions)
  CREATE TEMP TABLE same_group_pairs ON COMMIT DROP AS
  SELECT DISTINCT pg1."postId" AS post_a, pg2."postId" AS post_b
  FROM "PostGroup" pg1
  JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
  WHERE pg1."postId" != pg2."postId";

  CREATE INDEX ON same_group_pairs (post_a, post_b);

  -- Compute all similarities in one set-based query
  -- For each source post, find all other posts sharing tags and rank them
  INSERT INTO "PostRecommendation" ("postId", "recommendedId", score)
  SELECT post_a, post_b, score
  FROM (
    SELECT
      pt1."postId" AS post_a,
      pt2."postId" AS post_b,
      SUM(t."idfWeight") AS score,
      ROW_NUMBER() OVER (PARTITION BY pt1."postId" ORDER BY SUM(t."idfWeight") DESC) AS rn
    FROM "PostTag" pt1
    JOIN "PostTag" pt2 ON pt1."tagId" = pt2."tagId" AND pt1."postId" != pt2."postId"
    JOIN "Tag" t ON pt1."tagId" = t.id
    WHERE t."postCount" > 0
      AND NOT EXISTS (
        SELECT 1 FROM same_group_pairs sgp
        WHERE sgp.post_a = pt1."postId" AND sgp.post_b = pt2."postId"
      )
    GROUP BY pt1."postId", pt2."postId"
  ) scored
  WHERE rn <= p_limit;

  -- Get total recommendations inserted
  SELECT COUNT(*) INTO v_inserted FROM "PostRecommendation";

  processed := v_inserted;
  total := v_total;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Populate initial idfWeight values for existing tags
DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM "Post";

  IF v_total > 0 THEN
    UPDATE "Tag" SET "idfWeight" = GREATEST(0, LN(v_total::FLOAT / GREATEST(1, "postCount")))
    WHERE "postCount" > 0;
  END IF;
END $$;
