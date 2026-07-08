-- Recommendation compute v2: preserve upstream cosine scoring/frequency floor,
-- but make candidate discovery bounded and per-seed.
--
-- Upstream migrations 20260707120000_cosine_tag_similarity and
-- 20260707000000_prune_common_source_tags define the scoring contract:
--   * numerator = SUM(idfWeight^2) over retained source tags shared by the
--     candidate;
--   * denominator = FULL Post.tagIdfNorm(source) * FULL Post.tagIdfNorm(candidate);
--   * retained source tags have postCount > 1 and do not exceed the 30%/500-post
--     ubiquity floor;
--   * zero/stale norms score 0 instead of dividing by zero.
--
-- This migration keeps that contract and changes only the compute shape:
--   1. retrieve candidates from the source's top-16 retained tags, keeping the
--      top 400 by phase-1 dot16;
--   2. rerank those <=400 candidates by the exact cosine over the source's full
--      scoring tag set (top-64 retained tags, or p_max_source_tags for batch).
--
-- The batch function wraps that whole two-phase body in a LATERAL subquery per
-- seed, so each seed applies top-K/floor pruning before touching candidate
-- posting lists. Phase 2 joins the small candidate-id set to PostTag by postId
-- and hash-filters against the scoring tags; it does not re-scan posting lists.

-- ---------------------------------------------------------------------------
-- Single-post function: unchanged 3-arg signature. p_total_posts is honored as
-- the corpus size when supplied (>0), else reltuples/exact-count fallback.
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
  WITH scoring_tags AS (
    -- Full retained scoring set: top-64 qualifying, non-ubiquitous source tags.
    SELECT pt."tagId", t."idfWeight"
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = p_post_id
      AND t."postCount" > 1
      AND t."postCount" <= v_max_pc
    ORDER BY t."idfWeight" DESC, pt."tagId"
    LIMIT 64
  ),
  retrieval_tags AS (
    -- Bounded phase-1 retrieval set. Prod measurement: top-16 cut join rows
    -- from ~57M to ~1.76M for 109 seeds while keeping most true top-10s
    -- reachable for the phase-2 reranker.
    SELECT st."tagId", st."idfWeight"
    FROM scoring_tags st
    ORDER BY st."idfWeight" DESC, st."tagId"
    LIMIT 16
  ),
  excluded_posts AS (
    -- Posts sharing a group with the source (same Pixiv/Twitter set) are
    -- excluded from its own recommendations.
    SELECT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  ),
  phase1 AS (
    SELECT
      pt."postId" AS candidate_id,
      SUM(rt."idfWeight" * rt."idfWeight") AS dot16
    FROM retrieval_tags rt
    JOIN "PostTag" pt ON pt."tagId" = rt."tagId"
    WHERE pt."postId" != p_post_id
      AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
    GROUP BY pt."postId"
    ORDER BY SUM(rt."idfWeight" * rt."idfWeight") DESC, pt."postId"
    LIMIT 400
  ),
  reranked AS (
    SELECT
      p1.candidate_id,
      SUM(st."idfWeight" * st."idfWeight") AS dot
    FROM phase1 p1
    JOIN "PostTag" cpt ON cpt."postId" = p1.candidate_id
    JOIN scoring_tags st ON st."tagId" = cpt."tagId"
    GROUP BY p1.candidate_id
  )
  SELECT
    rr.candidate_id AS recommended_id,
    -- Cosine; 0 when either norm is stale/absent (post not yet recalculated).
    CASE
      WHEN v_src_norm > 0 AND cp."tagIdfNorm" > 0
        THEN rr.dot / (v_src_norm * cp."tagIdfNorm")
      ELSE 0
    END AS score
  FROM reranked rr
  JOIN "Post" cp ON cp.id = rr.candidate_id
  ORDER BY 2 DESC, 1
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- ---------------------------------------------------------------------------
-- Batch function: unchanged signature. p_max_source_tags keeps its existing
-- meaning: the retained scoring-tag cap (default 64). Retrieval is hardcoded to
-- top-16 and rerank depth to 400, then exact scoring is computed over the full
-- retained scoring set inside each seed's LATERAL body.
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
  SELECT s.source_id, rec.recommended_id, rec.score
  FROM (
    SELECT DISTINCT u AS source_id
    FROM unnest(p_post_ids) AS u
  ) s
  CROSS JOIN LATERAL (
    WITH source_post AS (
      SELECT p."tagIdfNorm" AS source_norm
      FROM "Post" p
      WHERE p.id = s.source_id
    ),
    scoring_tags AS (
      -- Full retained scoring set for this seed.
      SELECT pt."tagId", t."idfWeight"
      FROM "PostTag" pt
      JOIN "Tag" t ON t.id = pt."tagId"
      WHERE pt."postId" = s.source_id
        AND t."postCount" > 1
        AND t."postCount" <= v_max_pc
      ORDER BY t."idfWeight" DESC, pt."tagId"
      LIMIT p_max_source_tags
    ),
    retrieval_tags AS (
      -- Per-seed bounded retrieval set. The LATERAL boundary is intentional: it
      -- forces top-16/floor pruning before this seed scans candidate postings.
      SELECT st."tagId", st."idfWeight"
      FROM scoring_tags st
      ORDER BY st."idfWeight" DESC, st."tagId"
      LIMIT 16
    ),
    excluded_posts AS (
      SELECT pg2."postId"
      FROM "PostGroup" pg1
      JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
      WHERE pg1."postId" = s.source_id
    ),
    phase1 AS (
      SELECT
        pt."postId" AS candidate_id,
        SUM(rt."idfWeight" * rt."idfWeight") AS dot16
      FROM retrieval_tags rt
      JOIN "PostTag" pt ON pt."tagId" = rt."tagId"
      WHERE pt."postId" != s.source_id
        AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
      GROUP BY pt."postId"
      ORDER BY SUM(rt."idfWeight" * rt."idfWeight") DESC, pt."postId"
      LIMIT 400
    ),
    reranked AS (
      SELECT
        p1.candidate_id,
        SUM(st."idfWeight" * st."idfWeight") AS dot
      FROM phase1 p1
      JOIN "PostTag" cpt ON cpt."postId" = p1.candidate_id
      JOIN scoring_tags st ON st."tagId" = cpt."tagId"
      GROUP BY p1.candidate_id
    )
    SELECT
      rr.candidate_id AS recommended_id,
      CASE
        WHEN sp.source_norm > 0 AND cp."tagIdfNorm" > 0
          THEN rr.dot / (sp.source_norm * cp."tagIdfNorm")
        ELSE 0
      END AS score
    FROM reranked rr
    CROSS JOIN source_post sp
    JOIN "Post" cp ON cp.id = rr.candidate_id
    ORDER BY 2 DESC, 1
    LIMIT p_limit
  ) rec;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Neighborhood composition changes with two-phase retrieval/rerank; drop cached
-- scores so they recompute lazily under the new definitions.
DELETE FROM "PostRecommendation";
