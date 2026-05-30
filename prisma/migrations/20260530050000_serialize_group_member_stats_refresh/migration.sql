-- Serialize cached group member-stat refreshes by parent group.
-- The lock is intentionally acquired before the aggregate statement so a
-- transaction waiting behind another membership change reads a fresh snapshot.
CREATE OR REPLACE FUNCTION refresh_group_member_stats(target_group_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM "Group"
  WHERE id = target_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE "Group" g
  SET
    "memberCount" = stats.member_count,
    "memberHash" = stats.member_hash
  FROM (
    SELECT
      COUNT(pg."postId")::INTEGER AS member_count,
      CASE
        WHEN COUNT(pg."postId") > 0
          THEN MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId"))
        ELSE NULL
      END AS member_hash
    FROM "PostGroup" pg
    WHERE pg."groupId" = target_group_id
  ) stats
  WHERE g.id = target_group_id;
END;
$$;
