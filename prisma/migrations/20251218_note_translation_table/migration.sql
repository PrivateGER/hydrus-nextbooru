-- Create NoteTranslation table
CREATE TABLE "NoteTranslation" (
    "contentHash" CHAR(64) NOT NULL,
    "translatedContent" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteTranslation_pkey" PRIMARY KEY ("contentHash")
);

-- Migrate existing translations from Note to NoteTranslation
-- Use DISTINCT ON to handle duplicate contentHash values (pick the most recent)
INSERT INTO "NoteTranslation" ("contentHash", "translatedContent", "sourceLanguage", "targetLanguage", "translatedAt")
SELECT DISTINCT ON ("contentHash")
    "contentHash",
    "translatedContent",
    "sourceLanguage",
    "targetLanguage",
    "translatedAt"
FROM "Note"
WHERE "translatedContent" IS NOT NULL
ORDER BY "contentHash", "translatedAt" DESC;

-- Drop old translation columns from Note
ALTER TABLE "Note" DROP COLUMN "translatedContent";
ALTER TABLE "Note" DROP COLUMN "sourceLanguage";
ALTER TABLE "Note" DROP COLUMN "targetLanguage";
ALTER TABLE "Note" DROP COLUMN "translatedAt";