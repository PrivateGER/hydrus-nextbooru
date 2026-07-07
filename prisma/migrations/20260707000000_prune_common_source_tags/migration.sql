-- Recommendation quality + scale fix: drop the most commonly shared source tags.
--
-- The IDF-weighted similarity functions score a candidate by the SUM of the IDF
-- weights of the tags it shares with the source. Near-ubiquitous tags (e.g.
-- 1girl / solo / gender:female, present on a large fraction of the corpus)
-- carry an IDF weight of ~0 — LN(N / postCount) collapses toward zero as a tag
-- approaches the whole corpus — so they contribute almost nothing to the score
-- yet their posting lists are enormous and dominate the candidate scan. On a
-- large booru this is the scaling bottleneck: a source's top-64 tags can span
-- hundreds of thousands of PostTag rows, most of them ubiquitous tags with
-- near-zero scoring value.
--
-- Fix: a corpus-relative distinctiveness FLOOR on source tags. A tag present on
-- more than MAX_SOURCE_TAG_FREQUENCY of the corpus is dropped from the matching
-- set BEFORE the candidate scan. This removes the "basically meaningless" tags
-- (they were already near-zero-weight, so ranking is preserved) while bounding
-- every scanned posting list to a fraction of the table — total scan stays O(N)
-- but with a much smaller constant, and the worst-case single ubiquitous tag
-- (a ~whole-corpus posting list) is eliminated.
--
-- Threshold choice (measured on a real 1536-post, 107k-PostTag library over 40
-- sampled sources; top-20 result overlap vs. the pre-floor ranking):
--   30% -> Jaccard 0.93, scan -58%   (chosen: lowest quality risk)
--   10% -> Jaccard 0.77, scan -86%
--    5% -> Jaccard 0.66, scan -93%
-- 0.30 keeps mid-frequency content tags (characters/series/artists are almost
-- always well below 30%) and only drops the genuinely ubiquitous tail. To prune
-- more aggressively, lower the 0.30 literal in BOTH functions and the mirrored
-- MAX_SOURCE_TAG_FREQUENCY in src/lib/recommendations.ts, then recompute the
-- PostRecommendation cache (this migration clears it below).
--
-- Small-corpus safety: a tag must exceed BOTH 30% of the corpus AND an absolute
-- MIN_SOURCE_TAG_PRUNE_COUNT (500 posts) to be pruned. On a tiny library — or a
-- small test dataset — a tag can legitimately sit on a large FRACTION of a
-- handful of posts without being "massively shared", so the absolute floor keeps
-- the frequency prune dormant until 30% corresponds to a genuinely large posting
-- list. Below ~1667 posts the 500-count floor dominates; above it the 30%
-- fraction does.
--
-- The corpus size is read from the planner's row estimate (pg_class.reltuples,
-- O(1), maintained by ANALYZE/autovacuum); an approximate total is fine for a
-- frequency floor. It falls back to an exact COUNT only when the estimate is
-- unavailable (never analyzed => reltuples -1/0), so the floor can never
-- collapse to zero and drop every tag.
--
-- The top-64 count cap (MAX_SOURCE_TAGS) is retained as a secondary guard for
-- pathologically over-tagged posts.

-- ---------------------------------------------------------------------------
-- Single-post function: unchanged 3-arg signature. p_total_posts (previously
-- unused) is now honored as the corpus size when the caller supplies it (>0),
-- else the reltuples estimate / exact-count fallback is used.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_post_recommendations(
  p_post_id INTEGER,
  p_limit INTEGER DEFAULT 10,
  p_total_posts INTEGER DEFAULT NULL
) RETURNS TABLE (
  recommended_id INTEGER,
  score DOUBLE PRECISION
) AS $$
DECLARE
  v_total BIGINT;
  v_max_pc BIGINT;
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
  -- MAX_SOURCE_TAG_FREQUENCY = 0.30, MIN_SOURCE_TAG_PRUNE_COUNT = 500 (mirror in
  -- src/lib/recommendations.ts). A tag is pruned only if it exceeds BOTH 30% of
  -- the corpus AND 500 posts absolutely, so small libraries — and small test
  -- datasets, where a tag can legitimately sit on a large fraction of a handful
  -- of posts — are never pruned; the floor engages once 30% is a genuinely large
  -- posting list.
  v_max_pc := GREATEST(500, floor(v_total * 0.30))::bigint;

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
-- Batch function: unchanged signature. Same distinctiveness floor applied to
-- every source's tags in the one set-based pass.
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
  -- MAX_SOURCE_TAG_FREQUENCY = 0.30, MIN_SOURCE_TAG_PRUNE_COUNT = 500 (mirror in
  -- src/lib/recommendations.ts). See the single-post function above.
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
  WHERE scored.rn <= p_limit;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Scores change under the new floor; drop the cache so it recomputes lazily.
DELETE FROM "PostRecommendation";

-- Refresh Post's planner row estimate so the distinctiveness floor
-- (pg_class.reltuples) is correctly sized on the very first recompute after
-- deploy, and so the exact-count fallback is not taken. Keep bulk-import/sync
-- pipelines ANALYZEing "Post" for the same reason.
ANALYZE "Post";
