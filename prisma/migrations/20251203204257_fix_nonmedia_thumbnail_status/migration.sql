-- Fix existing non-media posts stuck in PENDING or incorrectly marked as FAILED
UPDATE "Post"
SET "thumbnailStatus" = 'UNSUPPORTED'
WHERE "thumbnailStatus" IN ('PENDING', 'FAILED')
  AND "mimeType" NOT LIKE 'image/%'
  AND "mimeType" NOT LIKE 'video/%';