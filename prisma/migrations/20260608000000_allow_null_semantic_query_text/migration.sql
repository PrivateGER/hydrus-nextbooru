-- Image-based semantic search reuses the SemanticQueryEmbedding cache: an
-- uploaded query image is keyed by its raw-byte hash plus preprocessing config
-- and has no recoverable text source, so `query` becomes nullable (NULL for image
-- rows).
ALTER TABLE "SemanticQueryEmbedding" ALTER COLUMN "query" DROP NOT NULL;
