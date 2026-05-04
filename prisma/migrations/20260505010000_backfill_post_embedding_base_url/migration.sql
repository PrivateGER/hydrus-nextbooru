-- Older local databases may have PostEmbedding rows created before embeddings
-- were scoped by backend URL. Bring those databases up to the current schema
-- without disturbing fresh databases where the initial embedding migration
-- already created this column and these indexes.
ALTER TABLE "PostEmbedding"
  ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;

UPDATE "PostEmbedding"
SET "baseUrl" = 'https://openrouter.ai/api/v1'
WHERE "baseUrl" IS NULL;

ALTER TABLE "PostEmbedding"
  ALTER COLUMN "baseUrl" SET NOT NULL;

DROP INDEX IF EXISTS "PostEmbedding_postId_model_dimensions_imageMaxResolution_key";
DROP INDEX IF EXISTS "PostEmbedding_model_dimensions_imageMaxResolution_status_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "PostEmbedding_config_key"
  ON "PostEmbedding"("postId", "baseUrl", model, dimensions, "imageMaxResolution");

CREATE INDEX IF NOT EXISTS "PostEmbedding_config_status_idx"
  ON "PostEmbedding"("baseUrl", model, dimensions, "imageMaxResolution", status);
