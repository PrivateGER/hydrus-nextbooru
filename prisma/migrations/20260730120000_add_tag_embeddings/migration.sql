-- Text embeddings of the tag vocabulary for semantic-search reranking.
-- No ANN index: tag-match scores are computed exactly over the bounded
-- candidate window of a semantic search (top-N posts joined to their tags).
CREATE TABLE "TagEmbedding" (
  "id" SERIAL NOT NULL,
  "tagId" INTEGER NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "embedding" vector,
  "status" "EmbeddingStatus" NOT NULL DEFAULT 'COMPLETE',
  "errorMessage" TEXT,
  "computedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TagEmbedding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TagEmbedding_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TagEmbedding_dimensions_positive_check" CHECK ("dimensions" > 0),
  CONSTRAINT "TagEmbedding_embedding_dimensions_check" CHECK (
    "embedding" IS NULL OR vector_dims("embedding") = "dimensions"
  ),
  CONSTRAINT "TagEmbedding_complete_has_embedding_check" CHECK (
    "status" <> 'COMPLETE' OR "embedding" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "TagEmbedding_config_key"
  ON "TagEmbedding"("tagId", "baseUrl", "model", "dimensions");

CREATE INDEX "TagEmbedding_config_status_idx"
  ON "TagEmbedding"("baseUrl", "model", "dimensions", "status");
