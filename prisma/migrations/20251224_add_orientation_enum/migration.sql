-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('landscape', 'portrait', 'square');

-- Add computed orientation column to Post
-- This column is automatically computed from width/height and stored for efficient querying
ALTER TABLE "Post" ADD COLUMN "orientation" "Orientation" GENERATED ALWAYS AS (
  CASE
    WHEN "width" IS NULL OR "height" IS NULL THEN NULL
    WHEN "width" > "height" THEN 'landscape'::"Orientation"
    WHEN "height" > "width" THEN 'portrait'::"Orientation"
    ELSE 'square'::"Orientation"
  END
) STORED;

-- Create index for efficient orientation queries
CREATE INDEX "Post_orientation_idx" ON "Post"("orientation");

-- Drop the old composite index on width/height since orientation queries now use the enum
DROP INDEX IF EXISTS "Post_width_height_idx";