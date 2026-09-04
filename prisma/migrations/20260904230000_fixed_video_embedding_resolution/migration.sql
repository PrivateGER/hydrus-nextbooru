-- Normalize videos created by prerelease builds; images retain their resolution keys.
BEGIN;
LOCK TABLE "PostEmbedding" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT pe.id, row_number() OVER (
    PARTITION BY pe."postId", pe."baseUrl", pe.model, pe.dimensions
    ORDER BY (pe.status = 'COMPLETE'::"EmbeddingStatus") DESC,
      pe."updatedAt" DESC, pe.id DESC
  ) AS position
  FROM "PostEmbedding" pe
  JOIN "Post" p ON p.id = pe."postId"
  WHERE p."mimeType" LIKE 'video/%'
)
DELETE FROM "PostEmbedding" pe
USING ranked
WHERE pe.id = ranked.id AND ranked.position > 1;

UPDATE "PostEmbedding" pe
SET "imageMaxResolution" = 480
FROM "Post" p
WHERE p.id = pe."postId" AND p."mimeType" LIKE 'video/%';

DELETE FROM "Settings" WHERE key = 'openrouter.embedding.calibration';

COMMIT;
