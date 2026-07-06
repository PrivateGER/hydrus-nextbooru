-- Recommendation compute: cold-cache performance fix.
--
-- Two problems with the previous per-post function under the "For You" feed:
--   1. buildFeed called compute_post_recommendations ONCE PER SEED (up to ~90
--      seeds cold). Each call is PARALLEL SAFE and spins up its own workers, so
--      dozens of them thrash every core (observed as a single query pegging
--      100% CPU — it is really N queries each parallelizing).
--   2. Every call joined "PostTag" on ALL of the source post's tags, including
--      near-ubiquitous tags whose posting lists are enormous but whose IDF
--      weight is ~0. Those tags dominate the candidate scan while contributing
--      almost nothing to the score.
--
-- Fixes:
--   * A batch function compute_recommendations_for_posts(int[]) computes every
--     seed's neighborhood in ONE set-based query. "PostTag" is scanned once and
--     hash-probed against the union of seed tags, instead of once per seed.
--   * Both functions cap each source post to its top-K highest-IDF tags
--     (p_max_source_tags). The dropped tags are the least distinctive (lowest
--     IDF), so ranking is preserved while the candidate explosion is bounded.

-- ---------------------------------------------------------------------------
-- Single-post function: add the top-K source-tag cap. Signature and return
-- shape are unchanged, so callers (getOrComputeRecommendations, detail-page
-- related posts, computeRecommendationsForPost) are unaffected apart from
-- being faster on heavily tagged posts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL,   -- kept for API compatibility, unused
  p_max_source_tags INTEGER DEFAULT 64  -- cap source tags to the K most distinctive
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH source_tags AS (
    -- The source post's tags with IDF weights, keeping only the p_max_source_tags
    -- most distinctive. Tags on a single post can never match another post, and
    -- the very common (low-IDF) tags contribute ~nothing to the score while
    -- exploding the candidate join, so they are the right ones to drop.
    SELECT pt."tagId", t."idfWeight"
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = p_post_id
      AND t."postCount" > 1
    ORDER BY t."idfWeight" DESC
    LIMIT p_max_source_tags
  ),
  excluded_posts AS (
    -- Posts sharing a group with the source (same Pixiv/Twitter set) are
    -- excluded from its own recommendations.
    SELECT pg2."postId"
    FROM "PostGroup" pg1
    JOIN "PostGroup" pg2 ON pg1."groupId" = pg2."groupId"
    WHERE pg1."postId" = p_post_id
  )
  SELECT
    pt."postId" AS recommended_id,
    SUM(st."idfWeight") AS score
  FROM source_tags st
  JOIN "PostTag" pt ON pt."tagId" = st."tagId"
  WHERE pt."postId" != p_post_id
    AND NOT EXISTS (SELECT 1 FROM excluded_posts ep WHERE ep."postId" = pt."postId")
  GROUP BY pt."postId"
  ORDER BY SUM(st."idfWeight") DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- ---------------------------------------------------------------------------
-- Batch function: compute neighborhoods for a SET of source posts in one pass.
-- Returns (source_id, recommended_id, score) with at most p_limit rows per
-- source. Used by the feed so N seeds cost one query, not N.
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
BEGIN
  RETURN QUERY
  WITH sources AS (
    SELECT DISTINCT s AS source_id
    FROM unnest(p_post_ids) AS s
  ),
  ranked_source_tags AS (
    -- Per-source tag list ranked by IDF so we can keep only the top-K.
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
  ),
  source_tags AS (
    SELECT source_id, "tagId", "idfWeight"
    FROM ranked_source_tags
    WHERE trn <= p_max_source_tags
  ),
  scored AS (
    SELECT
      st.source_id,
      pt."postId" AS recommended_id,
      SUM(st."idfWeight") AS score,
      ROW_NUMBER() OVER (
        PARTITION BY st.source_id ORDER BY SUM(st."idfWeight") DESC, pt."postId"
      ) AS rn
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
  )
  SELECT scored.source_id, scored.recommended_id, scored.score
  FROM scored
  WHERE rn <= p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;
