-- Rename NoteTranslation table to ContentTranslation
ALTER TABLE "NoteTranslation" RENAME TO "ContentTranslation";

-- Add titleHash generated column to Group
ALTER TABLE "Group" ADD COLUMN "titleHash" CHAR(64)
  GENERATED ALWAYS AS (
    CASE WHEN title IS NOT NULL THEN encode(digest(title, 'sha256'::text), 'hex'::text) ELSE NULL END
  ) STORED;

-- Create index on titleHash for efficient lookups
CREATE INDEX "Group_titleHash_idx" ON "Group"("titleHash");

-- Note: No FK constraint added - Prisma handles the relation at application level
-- (same pattern as Note.contentHash -> ContentTranslation.contentHash)
