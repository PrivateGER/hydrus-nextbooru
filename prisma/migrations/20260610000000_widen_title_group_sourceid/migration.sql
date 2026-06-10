-- Data migration: widen title-group sourceId from a 32-bit djb2 hash to the
-- lowercased normalized title used directly (collision-free).
--
-- Background:
--   TITLE groups previously stored sourceId = djb2(lower(normalizedTitle)) as an
--   8-hex-char string. At ~65k title groups that hash had ~50% probability of at
--   least one collision (birthday bound), silently merging unrelated series.
--   The new scheme stores sourceId = lower(Group.title) directly.
--
--   The normalized title is recoverable for every existing TITLE group because
--   sync writes it to Group.title (see bulkEnsureGroups / extractTitleGroups).
--
-- This migration:
--   1. Collapses TITLE groups that map to the SAME new sourceId (lower(title))
--      by MERGING their PostGroup memberships into one canonical group, then
--      deleting the redundant groups (so the @@unique(sourceType, sourceId)
--      constraint is not violated when we rewrite sourceId).
--   2. Rewrites each surviving TITLE group's sourceId to lower(title).
--   3. Refreshes cached member stats for affected groups.
--
-- It is a pure DATA migration (no schema change), so `prisma migrate dev` will
-- NOT generate it; it is hand-authored. It is idempotent: groups already on the
-- new scheme (sourceId = lower(title)) are simply left in place / re-merged.

-- A TITLE group with a NULL title cannot be migrated to the new scheme (we have
-- no string to key on). These are pre-existing anomalies; leave them untouched
-- so a future re-sync can rebuild them. The merge/rewrite below only touches
-- rows with a non-NULL title.

DO $$
DECLARE
  canonical RECORD;
  duplicate RECORD;
BEGIN
  -- Step 1 + 2: for each distinct lower(title) among TITLE groups, choose the
  -- lowest group id as canonical, merge the rest into it, then set sourceId.
  FOR canonical IN
    SELECT
      MIN(g.id) AS keep_id,
      lower(g."title") AS new_source_id
    FROM "Group" g
    WHERE g."sourceType" = 'TITLE'
      AND g."title" IS NOT NULL
    GROUP BY lower(g."title")
  LOOP
    -- Merge every other TITLE group sharing this new sourceId into keep_id.
    FOR duplicate IN
      SELECT g.id
      FROM "Group" g
      WHERE g."sourceType" = 'TITLE'
        AND g."title" IS NOT NULL
        AND lower(g."title") = canonical.new_source_id
        AND g.id <> canonical.keep_id
    LOOP
      -- Re-point memberships. A post may already belong to the canonical group
      -- (PostGroup PK is (postId, groupId)); skip those to avoid PK violations,
      -- preferring the canonical group's existing position.
      UPDATE "PostGroup" pg
      SET "groupId" = canonical.keep_id
      WHERE pg."groupId" = duplicate.id
        AND NOT EXISTS (
          SELECT 1 FROM "PostGroup" existing
          WHERE existing."groupId" = canonical.keep_id
            AND existing."postId" = pg."postId"
        );

      -- Drop any memberships that could not be moved (post already in canonical).
      DELETE FROM "PostGroup" pg WHERE pg."groupId" = duplicate.id;

      -- Remove the now-empty duplicate group.
      DELETE FROM "Group" g WHERE g.id = duplicate.id;
    END LOOP;

    -- Rewrite the surviving canonical group's sourceId to the new scheme.
    -- No-op if it already matches (idempotent re-runs).
    UPDATE "Group" g
    SET "sourceId" = canonical.new_source_id
    WHERE g.id = canonical.keep_id
      AND g."sourceId" <> canonical.new_source_id;
  END LOOP;
END $$;

-- Step 3: refresh cached member stats for every TITLE group. The
-- refresh_group_member_stats() function was introduced in
-- 20260530030000_cache_group_member_stats; guard in case it is absent.
DO $$
DECLARE
  g RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'refresh_group_member_stats'
  ) THEN
    FOR g IN SELECT id FROM "Group" WHERE "sourceType" = 'TITLE' LOOP
      PERFORM refresh_group_member_stats(g.id);
    END LOOP;
  END IF;
END $$;
