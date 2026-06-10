-- Data migration: widen title-group sourceId from a 32-bit djb2 hash to a
-- lowercased normalized-title key for normal-sized titles, with a bounded
-- SHA-256 fallback for unusually long titles.
--
-- Background:
--   TITLE groups previously stored sourceId = djb2(lower(normalizedTitle)) as an
--   8-hex-char string. At ~65k title groups that hash had ~50% probability of at
--   least one collision (birthday bound), silently merging unrelated series.
--   The new scheme stores sourceId = lower(Group.title) directly when the key is
--   short enough for PostgreSQL's btree index, otherwise it stores
--   sourceId = 'title-sha256:' || sha256(lower(Group.title)).
--
--   The normalized title is recoverable for every existing TITLE group because
--   sync writes it to Group.title (see bulkEnsureGroups / extractTitleGroups).
--
-- This migration:
--   1. Moves every migratable TITLE group into a deterministic temporary
--      namespace so rewriting sourceId cannot collide with another row's old
--      8-hex hash (or previous sourceId).
--   2. Collapses TITLE groups that map to the SAME new sourceId by MERGING their
--      PostGroup memberships into one canonical group, then deleting redundant
--      groups.
--   3. Rewrites each surviving TITLE group's sourceId to the new bounded scheme.
--   4. Refreshes cached member stats for affected groups.
--
-- It is a pure DATA migration (no schema change), so `prisma migrate dev` will
-- NOT generate it; it is hand-authored. It is idempotent: groups already on the
-- new scheme are temporarily namespaced and then rewritten to the same value.

-- A TITLE group with a NULL title cannot be migrated to the new scheme (we have
-- no string to key on). These are pre-existing anomalies; leave them untouched
-- so a future re-sync can rebuild them. The merge/rewrite below only touches
-- rows with a non-NULL title.

DO $$
DECLARE
  canonical RECORD;
  duplicate RECORD;
  max_direct_source_id_bytes CONSTANT integer := 240;
  hashed_source_id_prefix CONSTANT text := 'title-sha256:';
  -- Longer than max_direct_source_id_bytes so it cannot equal a final direct
  -- title sourceId; still short enough to be safe for the btree unique index.
  temp_source_id_prefix CONSTANT text := repeat('title-sourceid-migration-temp-', 10);
BEGIN
  -- Phase 1: move all migratable TITLE rows away from their old sourceIds before
  -- assigning final keys. This avoids transient unique violations such as a
  -- final key "deadbeef" colliding with another row's old 8-hex hash.
  UPDATE "Group" g
  SET "sourceId" = temp_source_id_prefix || g.id::text
  WHERE g."sourceType" = 'TITLE'
    AND g."title" IS NOT NULL
    AND g."sourceId" <> temp_source_id_prefix || g.id::text;

  -- Phase 2 + 3: for each distinct bounded sourceId among TITLE groups, choose
  -- the lowest group id as canonical, merge the rest into it, then set sourceId.
  FOR canonical IN
    WITH title_sources AS (
      SELECT
        g.id,
        CASE
          WHEN octet_length(lower(g."title")) <= max_direct_source_id_bytes THEN lower(g."title")
          ELSE hashed_source_id_prefix || encode(digest(lower(g."title"), 'sha256'), 'hex')
        END AS new_source_id
      FROM "Group" g
      WHERE g."sourceType" = 'TITLE'
        AND g."title" IS NOT NULL
    )
    SELECT MIN(id) AS keep_id, new_source_id
    FROM title_sources
    GROUP BY new_source_id
  LOOP
    -- Merge every other TITLE group sharing this new sourceId into keep_id.
    FOR duplicate IN
      SELECT g.id
      FROM "Group" g
      WHERE g."sourceType" = 'TITLE'
        AND g."title" IS NOT NULL
        AND (
          CASE
            WHEN octet_length(lower(g."title")) <= max_direct_source_id_bytes THEN lower(g."title")
            ELSE hashed_source_id_prefix || encode(digest(lower(g."title"), 'sha256'), 'hex')
          END
        ) = canonical.new_source_id
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
    -- No-op if it already matches (idempotent re-runs after the temp phase).
    UPDATE "Group" g
    SET "sourceId" = canonical.new_source_id
    WHERE g.id = canonical.keep_id
      AND g."sourceId" <> canonical.new_source_id;
  END LOOP;
END $$;

-- Step 4: refresh cached member stats for every TITLE group. The
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
