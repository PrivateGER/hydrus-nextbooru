-- Trigram GIN indexes backing the groups-listing filter resolver
-- (resolveGroupFilterIds in src/lib/groups.ts). The title/query filter runs
-- substring ILIKE against Group.sourceId, Group.title, and translated titles;
-- without these it degrades to sequential scans that grow with the Group
-- table. pg_trgm is already enabled (20251127_add_search_indexes).
-- CONCURRENTLY so live deploys do not block writes (same pattern as
-- 20251215_readd_trigram_index).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Group_title_trgm_idx"
  ON "Group" USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Group_sourceId_trgm_idx"
  ON "Group" USING GIN ("sourceId" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContentTranslation_translatedContent_trgm_idx"
  ON "ContentTranslation" USING GIN ("translatedContent" gin_trgm_ops);
