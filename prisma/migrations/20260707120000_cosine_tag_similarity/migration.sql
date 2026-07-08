-- Recommendation quality fix: cosine-normalize the tag similarity score.
--
-- The previous score was the raw SUM of the source tags' IDF weights over the
-- tags a candidate shares with the source. That is a dot product with NO
-- length normalization on the candidate side, which biases every neighborhood
-- toward heavily-tagged posts: a candidate with 300 tags has ~6x the chances
-- of sharing source tags as one with 50, independent of how related it is,
-- and sparsely-tagged posts are systematically buried. It also made scores
-- incomparable across sources (a source with many rare tags produced larger
-- sums for equally-related neighbors), which the feed then papered over by
-- dividing each seed's neighborhood by its own maximum — inflating a weak
-- best-match to look identical to a near-duplicate best-match.
--
-- New score: the true tf-idf cosine over binary tag vectors weighted by IDF.
--   score(s, c) = SUM over shared tags of idf(tag)^2
--                 / (tagIdfNorm(s) * tagIdfNorm(c))
-- where tagIdfNorm(p) = sqrt(SUM over p's tags of idf^2) is precomputed per
-- post ("Post"."tagIdfNorm", maintained alongside Tag.idfWeight by the
-- post-sync tag-stats recalculation). Properties:
--   * bounded to [0, 1]; 1 = tag-identical posts. Comparable across sources,
--     so downstream consumers (the "For You" feed) can drop their per-seed
--     max normalization and blend it directly with embedding cosines.
--   * candidate length-normalized: over-tagged posts no longer dominate, and
--     a sparsely-tagged post that genuinely matches ranks where it should.
--   * idf^2 in the numerator: sharing one rare tag (artist/character) now
--     outweighs sharing several near-generic tags, which matches how tag
--     identity actually signals relatedness on a booru.
--
-- Staleness semantics: a post whose tagIdfNorm is 0 (synced after the last
-- tag-stats recalculation) scores 0 rather than dividing by zero — the same
-- "meaningless until recalculated" behavior stale idfWeight already has. The
-- top-64 distinctiveness cap and the 30%/500-post ubiquity floor from
-- migration 20260707000000 are retained unchanged: they bound the candidate
-- scan; the norms fix the geometry. Note the numerator only sees the source's
-- retained (distinctive) tags while the norms cover ALL tags, so scores for
-- posts carrying many ubiquitous tags land slightly below the exact cosine —
-- a conservative, uniform-per-source shift that preserves ranking.

-- Per-post tag-IDF vector length. 0 = "not yet computed" (see above).
ALTER TABLE "Post" ADD COLUMN "tagIdfNorm" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill from current IDF weights so scores are meaningful immediately
-- after deploy instead of after the next full sync.
UPDATE "Post" p
SET "tagIdfNorm" = COALESCE(
  (
    SELECT SQRT(SUM(t."idfWeight" * t."idfWeight"))
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = p.id
  ),
  0
);

-- ---------------------------------------------------------------------------
-- Single-post function: unchanged 3-arg signature.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
#variable_conflict use_column
DECLARE
  v_total BIGINT;
  v_max_pc BIGINT;
  v_src_norm DOUBLE PRECISION;
BEGIN
  -- Corpus size for the distinctiveness floor: caller value, else planner
  -- estimate, else exact count (never 0 -> would drop every tag).
  v_total := NULLIF(p_total_posts, 0)::bigint;
  IF v_total IS NULL OR v_total <= 0 THEN
    v_total := NULLIF((SELECT reltuples FROM pg_class WHERE oid = '"Post"'::regclass), -1)::bigint;
  END IF;
  IF v_total IS NULL OR v_total <= 0 THEN
    SELECT count(*) INTO v_total FROM "Post";
  END IF;
  -- MAX_SOURCE_TAG_FREQUENCY = 0.30, MIN_SOURCE_TAG_PRUNE_COUNT = 500 (mirror
  -- in src/lib/recommendations.ts; rationale in migration 20260707000000).
  v_max_pc := GREATEST(500, floor(v_total * 0.30))::bigint;

  SELECT p."tagIdfNorm" INTO v_src_norm FROM "Post" p WHERE p.id = p_post_id;

  RETURN QUERY
  WITH source_tags AS (
    -- The source post's tags with IDF weights, keeping only the 64 most
    -- distinctive AND dropping tags present on more than 30% of the corpus
    -- (near-zero IDF, huge posting lists). Tags on a single post never match.
    SELECT pt."tagId", t."idfWeight"
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = p_post_id
      AND t."postCount" > 1
      AND t."postCount" <= v_max_pc
    ORDER BY t."idfWeight" DESC
    LIMIT 64
  ),
  excluded_posts AS (
    -- Posts sharing a group with the source (same Pixiv/Twitter set) are
    -- excluded from its own recommendations.
    SELECT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  ),
  shared AS (
    SELECT
      pt."postId" AS candidate_id,
      SUM(st."idfWeight" * st."idfWeight") AS dot
    FROM source_tags st
    JOIN "PostTag" pt ON pt."tagId" = st."tagId"
    WHERE pt."postId" != p_post_id
      AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
    GROUP BY pt."postId"
  )
  SELECT
    sh.candidate_id AS recommended_id,
    -- Cosine; 0 when either norm is stale/absent (post not yet recalculated).
    CASE
      WHEN v_src_norm > 0 AND cp."tagIdfNorm" > 0
        THEN sh.dot / (v_src_norm * cp."tagIdfNorm")
      ELSE 0
    END AS score
  FROM shared sh
  JOIN "Post" cp ON cp.id = sh.candidate_id
  ORDER BY 2 DESC, 1
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- ---------------------------------------------------------------------------
-- Batch function: unchanged signature. Same cosine applied to every source in
-- the one set-based pass.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_recommendations_for_posts(
  p_post_ids INTEGER[],
  p_limit INTEGER DEFAULT 20,
  p_max_source_tags INTEGER DEFAULT 64
) RETURNS TABLE (
  source_id INTEGER,
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
#variable_conflict use_column
DECLARE
  v_total BIGINT;
  v_max_pc BIGINT;
BEGIN
  v_total := NULLIF((SELECT reltuples FROM pg_class WHERE oid = '"Post"'::regclass), -1)::bigint;
  IF v_total IS NULL OR v_total <= 0 THEN
    SELECT count(*) INTO v_total FROM "Post";
  END IF;
  -- MAX_SOURCE_TAG_FREQUENCY = 0.30, MIN_SOURCE_TAG_PRUNE_COUNT = 500 (mirror
  -- in src/lib/recommendations.ts; rationale in migration 20260707000000).
  v_max_pc := GREATEST(500, floor(v_total * 0.30))::bigint;

  RETURN QUERY
  WITH sources AS (
    SELECT DISTINCT u AS source_id
    FROM unnest(p_post_ids) AS u
  ),
  ranked_source_tags AS (
    -- Per-source tag list ranked by IDF so we can keep only the top-K, after
    -- dropping tags on more than 30% of the corpus (non-distinctive).
    SELECT
      sr.source_id,
      pt."tagId",
      t."idfWeight",
      ROW_NUMBER() OVER (
        PARTITION BY sr.source_id ORDER BY t."idfWeight" DESC, pt."tagId"
      ) AS trn
    FROM sources sr
    JOIN "PostTag" pt ON pt."postId" = sr.source_id
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE t."postCount" > 1
      AND t."postCount" <= v_max_pc
  ),
  source_tags AS (
    SELECT rst.source_id, rst."tagId", rst."idfWeight"
    FROM ranked_source_tags rst
    WHERE rst.trn <= p_max_source_tags
  ),
  shared AS (
    SELECT
      st.source_id,
      pt."postId" AS candidate_id,
      SUM(st."idfWeight" * st."idfWeight") AS dot
    FROM source_tags st
    JOIN "PostTag" pt ON pt."tagId" = st."tagId"
    WHERE pt."postId" != st.source_id
      AND NOT EXISTS (
        SELECT 1
        FROM "PostGroup" sg
        JOIN "PostGroup" rg ON rg."groupId" = sg."groupId"
        WHERE sg."postId" = st.source_id
          AND rg."postId" = pt."postId"
      )
    GROUP BY st.source_id, pt."postId"
  ),
  cosined AS (
    SELECT
      sh.source_id,
      sh.candidate_id,
      CASE
        WHEN sp."tagIdfNorm" > 0 AND cp."tagIdfNorm" > 0
          THEN sh.dot / (sp."tagIdfNorm" * cp."tagIdfNorm")
        ELSE 0
      END AS cscore
    FROM shared sh
    JOIN "Post" sp ON sp.id = sh.source_id
    JOIN "Post" cp ON cp.id = sh.candidate_id
  ),
  ranked AS (
    SELECT
      co.source_id,
      co.candidate_id,
      co.cscore,
      ROW_NUMBER() OVER (
        PARTITION BY co.source_id ORDER BY co.cscore DESC, co.candidate_id
      ) AS rn
    FROM cosined co
  )
  SELECT r.source_id, r.candidate_id AS recommended_id, r.cscore AS score
  FROM ranked r
  WHERE r.rn <= p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Scores change scale (raw IDF sums -> [0,1] cosines); drop the cache so it
-- recomputes lazily under the new scoring.
DELETE FROM "PostRecommendation";

-- Keep the planner estimate behind the distinctiveness floor fresh (and pick
-- up the new column's stats).
ANALYZE "Post";
