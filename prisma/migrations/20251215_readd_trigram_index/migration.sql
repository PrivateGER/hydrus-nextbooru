-- Add GIN trigram index for fast case-insensitive LIKE/ILIKE queries on tag names
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tag_name_trgm_idx" ON "Tag" USING GIN (name gin_trgm_ops);
