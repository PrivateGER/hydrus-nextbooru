-- Initialize stats.totalPostCount setting with current post count
-- This setting is updated after each sync by updateTotalPostCount()
-- Uses ON CONFLICT to make it idempotent (safe to re-run)

INSERT INTO "Settings" ("key", "value", "updatedAt")
VALUES ('stats.totalPostCount', (SELECT COUNT(*)::text FROM "Post"), NOW())
ON CONFLICT ("key") DO UPDATE
SET "value" = (SELECT COUNT(*)::text FROM "Post"),
    "updatedAt" = NOW();
