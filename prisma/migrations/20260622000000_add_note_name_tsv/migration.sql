-- Stored tsvector for note names, mirroring the existing "contentTsv" column.
--
-- The posts-search notes filter (src/lib/search.ts) matched note names with an
-- inline to_tsvector('simple', name), which no index can serve, forcing a
-- sequential scan over "Note" that recomputed the tsvector per row. Add a
-- stored generated column + GIN index so that filter is index-backed, the same
-- way 20251218_optimize_note_search did for content.
ALTER TABLE "Note" ADD COLUMN "nameTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', name)) STORED;

CREATE INDEX "Note_nameTsv_idx" ON "Note" USING GIN ("nameTsv");
