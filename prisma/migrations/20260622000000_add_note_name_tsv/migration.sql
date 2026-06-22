-- Stored tsvector + GIN index for note names so the posts-search notes filter
-- is index-backed, mirroring "contentTsv" from 20251218_optimize_note_search.
ALTER TABLE "Note" ADD COLUMN "nameTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', name)) STORED;

CREATE INDEX "Note_nameTsv_idx" ON "Note" USING GIN ("nameTsv");
