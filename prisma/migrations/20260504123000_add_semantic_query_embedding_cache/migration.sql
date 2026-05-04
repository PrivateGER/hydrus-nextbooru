-- Cache text query embeddings used for semantic image search.
-- This avoids repeated OpenRouter embedding round-trips for repeated queries
-- with the same model and output dimension.
CREATE TABLE "SemanticQueryEmbedding" (
  "queryHash" CHAR(64) NOT NULL,
  "query" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "embedding" vector NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SemanticQueryEmbedding_pkey" PRIMARY KEY ("queryHash", "model", "dimensions"),
  CONSTRAINT "SemanticQueryEmbedding_dimensions_positive_check" CHECK ("dimensions" > 0),
  CONSTRAINT "SemanticQueryEmbedding_embedding_dimensions_check" CHECK (vector_dims("embedding") = "dimensions")
);

CREATE INDEX "SemanticQueryEmbedding_model_dimensions_lastUsedAt_idx"
  ON "SemanticQueryEmbedding"("model", "dimensions", "lastUsedAt");
