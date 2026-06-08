-- Image-based semantic search reuses the SemanticQueryEmbedding cache: an
-- uploaded query image is keyed by the SHA-256 of its raw bytes and has no
-- recoverable text source, so `query` becomes nullable (NULL for image rows).
ALTER TABLE "SemanticQueryEmbedding" ALTER COLUMN "query" DROP NOT NULL;
