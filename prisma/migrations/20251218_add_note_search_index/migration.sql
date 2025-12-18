-- Add GIN trigram index for fast ILIKE queries on note content
-- Uses pg_trgm extension (already enabled in 20251127_add_search_indexes)
CREATE INDEX IF NOT EXISTS "Note_content_trgm_idx" ON "Note" USING GIN (content gin_trgm_ops);

-- Add GIN index for full-text search using tsvector
-- Uses 'simple' configuration to handle multilingual content (no stemming)
CREATE INDEX IF NOT EXISTS "Note_content_fts_idx" ON "Note" USING GIN (to_tsvector('simple', content));

-- Also index the note name for searching by title
CREATE INDEX IF NOT EXISTS "Note_name_trgm_idx" ON "Note" USING GIN (name gin_trgm_ops);
