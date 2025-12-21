-- Mark existing videos and animated images as PENDING for reprocessing
-- to generate animated previews.

UPDATE "Post"
SET "thumbnailStatus" = 'PENDING'::"ThumbnailStatus"
WHERE "thumbnailStatus" = 'COMPLETE'::"ThumbnailStatus"
  AND "duration" IS NOT NULL
  AND (
    "mimeType" LIKE 'video/%'
    OR "mimeType" IN ('image/gif', 'image/apng')
  );