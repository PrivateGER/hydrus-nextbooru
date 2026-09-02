-- Recommendation compute v4: same scoring contract as v3 (migration
-- 20260722150000). The rerank CTE becomes a LATERAL per candidate so the
-- planner reads each candidate's tags via the PostTag primary key instead of
-- scanning every scoring tag's posting list. Results are identical; cached
-- rows stay valid.

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
    -- LATERAL pins the join direction: read each candidate's own tags via the
    -- PostTag primary key instead of scanning every scoring tag's posting list.
    SELECT p1.candidate_id, d.dot
    FROM phase1 p1
    CROSS JOIN LATERAL (
      SELECT SUM(st."idfWeight" * st."idfWeight") AS dot
      FROM "PostTag" cpt
      JOIN scoring_tags st ON st."tagId" = cpt."tagId"
      WHERE cpt."postId" = p1.candidate_id
    ) d
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
      SELECT p1.candidate_id, d.dot
      FROM phase1 p1
      CROSS JOIN LATERAL (
        SELECT SUM(st."idfWeight" * st."idfWeight") AS dot
        FROM "PostTag" cpt
        JOIN scoring_tags st ON st."tagId" = cpt."tagId"
        WHERE cpt."postId" = p1.candidate_id
      ) d
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
