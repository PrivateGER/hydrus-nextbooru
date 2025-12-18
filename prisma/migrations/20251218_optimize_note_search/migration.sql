-- Optimize note search by adding stored tsvector columns
-- This avoids computing to_tsvector() at query time

-- Add stored tsvector column to Note table
ALTER TABLE "Note" ADD COLUMN "contentTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- Add stored tsvector column to NoteTranslation table
ALTER TABLE "NoteTranslation" ADD COLUMN "translatedTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "translatedContent")) STORED;

-- Create GIN indexes on the stored tsvector columns
CREATE INDEX "Note_contentTsv_idx" ON "Note" USING GIN ("contentTsv");
CREATE INDEX "NoteTranslation_translatedTsv_idx" ON "NoteTranslation" USING GIN ("translatedTsv");

-- Drop the old expression indexes
DROP INDEX IF EXISTS "Note_content_fts_idx";
DROP INDEX IF EXISTS "NoteTranslation_translatedContent_fts_idx";
