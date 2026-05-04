-- VectorChord-backed image embeddings for semantic image search.
-- vchord installs pgvector as a dependency, but vector is created explicitly so
-- failures point at the missing vector-capable database image immediately.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vchord CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'Required PostgreSQL extension "vector" is not installed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vchord') THEN
    RAISE EXCEPTION 'Required PostgreSQL extension "vchord" is not installed';
  END IF;
END
$$;

CREATE TYPE "EmbeddingStatus" AS ENUM ('COMPLETE', 'FAILED');

CREATE TABLE "PostEmbedding" (
  "id" SERIAL NOT NULL,
  "postId" INTEGER NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "imageMaxResolution" INTEGER NOT NULL,
  "sourceWidth" INTEGER,
  "sourceHeight" INTEGER,
  "processedWidth" INTEGER,
  "processedHeight" INTEGER,
  "embedding" vector,
  "status" "EmbeddingStatus" NOT NULL DEFAULT 'COMPLETE',
  "errorMessage" TEXT,
  "computedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostEmbedding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostEmbedding_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostEmbedding_dimensions_positive_check" CHECK ("dimensions" > 0),
  CONSTRAINT "PostEmbedding_imageMaxResolution_positive_check" CHECK ("imageMaxResolution" > 0),
  CONSTRAINT "PostEmbedding_embedding_dimensions_check" CHECK (
    "embedding" IS NULL OR vector_dims("embedding") = "dimensions"
  ),
  CONSTRAINT "PostEmbedding_complete_has_embedding_check" CHECK (
    "status" <> 'COMPLETE' OR "embedding" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "PostEmbedding_postId_model_dimensions_imageMaxResolution_key"
  ON "PostEmbedding"("postId", "model", "dimensions", "imageMaxResolution");

CREATE INDEX "PostEmbedding_postId_idx" ON "PostEmbedding"("postId");
CREATE INDEX "PostEmbedding_model_dimensions_imageMaxResolution_status_idx"
  ON "PostEmbedding"("model", "dimensions", "imageMaxResolution", "status");

-- OpenRouter's current multimodal Gemini embedding model recommends 768,
-- 1536, or 3072 output dimensions. Use expression indexes because the table
-- stores generic vectors so the active embedding dimension can be configured.
CREATE INDEX "PostEmbedding_embedding_768_vchord_idx"
  ON "PostEmbedding"
  USING vchordrq (("embedding"::vector(768)) vector_cosine_ops)
  WHERE "status" = 'COMPLETE' AND "dimensions" = 768;

CREATE INDEX "PostEmbedding_embedding_1536_vchord_idx"
  ON "PostEmbedding"
  USING vchordrq (("embedding"::vector(1536)) vector_cosine_ops)
  WHERE "status" = 'COMPLETE' AND "dimensions" = 1536;

CREATE INDEX "PostEmbedding_embedding_3072_vchord_idx"
  ON "PostEmbedding"
  USING vchordrq (("embedding"::vector(3072)) vector_cosine_ops)
  WHERE "status" = 'COMPLETE' AND "dimensions" = 3072;
