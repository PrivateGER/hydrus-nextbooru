-- Enable pg_trgm extension for fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN trigram index for fast case-insensitive LIKE/ILIKE queries on tag names
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING GIN (name gin_trgm_ops);
