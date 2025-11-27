-- Remove filePath and thumbnailPath columns from Post table
-- These paths are now computed at runtime from hash + extension + HYDRUS_FILES_PATH env var

-- First, ensure extension is populated from filePath for any records missing it
-- Extract extension from filePath (e.g., '/path/to/file.jpg' -> '.jpg')
UPDATE "Post"
SET "extension" = substring("filePath" from '(\.[^.]+)$')
WHERE "extension" IS NULL OR "extension" = '';

-- Drop the columns (data is not needed - paths can be reconstructed from hash + extension)
ALTER TABLE "Post" DROP COLUMN IF EXISTS "filePath";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "thumbnailPath";
