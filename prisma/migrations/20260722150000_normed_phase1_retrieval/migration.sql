-- Recommendation compute v3: norm-aware phase-1 ordering + deeper rerank.
--
-- The scoring contract is unchanged from v2 (migration 20260708130000):
--   * numerator = SUM(idfWeight^2) over retained source tags shared by the
--     candidate;
--   * denominator = FULL Post.tagIdfNorm(source) * FULL Post.tagIdfNorm(candidate);
--   * retained source tags have postCount > 1 and do not exceed the 30%/500-post
--     ubiquity floor; retrieval stays the top-16 retained tags;
--   * zero/stale norms score 0 instead of dividing by zero.
--
-- What changes is HOW phase 1 ranks the candidates it keeps for the exact
-- rerank:
--   1. Phase-1 ordering divides the partial dot (over the 16 retrieval tags)
--      by the candidate's precomputed tagIdfNorm — an approximate cosine with
--      an underestimated numerator but EXACT denominator. The old raw-dot
--      ordering had no denominator at all, so high-tag-count "hub" posts
--      crowded the cutoff and pushed true neighbors out: prod measured true
--      top-10 candidates stranded at phase-1 ranks 455..9501 on flat-IDF
--      seeds. NULLS LAST keeps stale/zero-norm candidates (which score 0 in
--      the exact rerank anyway) from occupying cutoff slots.
--   2. The rerank window doubles to 800. Phase 2 joins the candidate set to
--      PostTag by postId (no posting-list scan), so the extra depth costs
--      ~10% while catching candidates that land just past the old 400 cutoff.
--
-- Prod-measured effect (24 sampled seeds + the worst known seed, overlap@10
-- against the exact K=64 cosine): 17/24 perfect -> 23/24 perfect, mean 9.25
-- -> ~9.9, worst seed 3/10 -> 7/10. Phase-1 posting-list scan volume is
-- unchanged (same 16 retrieval tags); the norm join adds one Post lookup per
-- scanned posting row, ~2x the compute stage on a cold batch (0.9s -> ~1.9s
-- per 20 seeds), amortized by the 24h PostRecommendation cache.
--
-- A widened retrieval set (top tags until 90% cumulative idf^2 mass, cap 24)
-- was prototyped and REJECTED: 3-4x scan volume for +0.08 mean overlap and no
-- improvement on the worst seeds — their loss came from hub crowding at the
-- rerank cutoff, not from missing retrieval tags.

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
    -- Bounded phase-1 retrieval set (see migration 20260708130000 for the
    -- top-16 scan-volume rationale).
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
    -- Approximate cosine ordering: partial dot over the retrieval tags,
    -- divided by the candidate's exact precomputed norm.
    SELECT
      pt."postId" AS candidate_id
    FROM retrieval_tags rt
    JOIN "PostTag" pt ON pt."tagId" = rt."tagId"
    JOIN "Post" cp ON cp.id = pt."postId"
    WHERE pt."postId" != p_post_id
      AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
    GROUP BY pt."postId"
    ORDER BY SUM(rt."idfWeight" * rt."idfWeight") / NULLIF(max(cp."tagIdfNorm"), 0)
             DESC NULLS LAST,
             pt."postId"
    LIMIT 800
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
-- meaning: the retained scoring-tag cap (default 64). Retrieval is hardcoded
-- to top-16 and rerank depth to 800; exact scoring runs over the full
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
      -- Approximate cosine ordering: partial dot over the retrieval tags,
      -- divided by the candidate's exact precomputed norm.
      SELECT
        pt."postId" AS candidate_id
      FROM retrieval_tags rt
      JOIN "PostTag" pt ON pt."tagId" = rt."tagId"
      JOIN "Post" cp ON cp.id = pt."postId"
      WHERE pt."postId" != s.source_id
        AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
      GROUP BY pt."postId"
      ORDER BY SUM(rt."idfWeight" * rt."idfWeight") / NULLIF(max(cp."tagIdfNorm"), 0)
               DESC NULLS LAST,
               pt."postId"
      LIMIT 800
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

-- Neighborhood composition changes with norm-aware retrieval ordering; drop
-- cached scores so they recompute lazily under the new definitions.
DELETE FROM "PostRecommendation";
