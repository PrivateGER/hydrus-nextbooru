-- Mark existing videos and animated images as PENDING for reprocessing
-- to generate animated previews. The generator will filter by duration.

UPDATE "Post"
SET "thumbnailStatus" = 'PENDING'::"ThumbnailStatus"
WHERE "thumbnailStatus" = 'COMPLETE'::"ThumbnailStatus"
  AND (
    "mimeType" LIKE 'video/%'
    OR "mimeType" IN ('image/gif', 'image/apng')
  );