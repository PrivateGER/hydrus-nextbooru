-- Add stored tsvector column for group title full-text search
-- This avoids computing to_tsvector() at query time and allows GIN index usage

-- Add stored tsvector column to Group table (only populated when title is not null)
ALTER TABLE "Group" ADD COLUMN "titleTsv" tsvector
  GENERATED ALWAYS AS (
    CASE WHEN title IS NOT NULL THEN to_tsvector('simple', title) ELSE NULL END
  ) STORED;

-- Create GIN index on the stored tsvector column
CREATE INDEX "Group_titleTsv_idx" ON "Group" USING GIN ("titleTsv");
