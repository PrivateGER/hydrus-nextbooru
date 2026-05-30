-- Cache group membership shape on Group so listing pages do not aggregate PostGroup on every request.
ALTER TABLE "Group"
  ADD COLUMN "memberHash" CHAR(32),
  ADD COLUMN "memberCount" INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION refresh_group_member_stats(target_group_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION refresh_post_group_member_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_group_member_stats(NEW."groupId");
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_group_member_stats(OLD."groupId");
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."groupId" <> OLD."groupId" THEN
      PERFORM refresh_group_member_stats(OLD."groupId");
    END IF;
    PERFORM refresh_group_member_stats(NEW."groupId");
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

UPDATE "Group" g
SET
  "memberCount" = stats.member_count,
  "memberHash" = stats.member_hash
FROM (
  SELECT
    g.id,
    COUNT(pg."postId")::INTEGER AS member_count,
    CASE
      WHEN COUNT(pg."postId") > 0
        THEN MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId"))
      ELSE NULL
    END AS member_hash
  FROM "Group" g
  LEFT JOIN "PostGroup" pg ON pg."groupId" = g.id
  GROUP BY g.id
) stats
WHERE g.id = stats.id;

CREATE TRIGGER "PostGroup_refresh_group_member_stats"
AFTER INSERT OR UPDATE OR DELETE ON "PostGroup"
FOR EACH ROW
EXECUTE FUNCTION refresh_post_group_member_stats();

CREATE INDEX "Group_memberCount_sourceType_idx" ON "Group"("memberCount", "sourceType");
CREATE INDEX "Group_memberHash_idx" ON "Group"("memberHash");
