-- Enforce the singleton invariant before adding the unique key. A prior race in
-- acquireOcrBatchLock (concurrent create on an empty table) could insert multiple
-- OcrBatchState rows. Collapse to a single row, keeping the most recently updated
-- one (highest id breaks ties), so the unique index below can be created safely.
DELETE FROM "OcrBatchState"
WHERE "id" NOT IN (
    SELECT "id" FROM "OcrBatchState"
    ORDER BY "updatedAt" DESC, "id" DESC
    LIMIT 1
);

-- DropIndex
DROP INDEX "ImageTextRegion_postId_idx";

-- AlterTable
ALTER TABLE "OcrBatchState" ADD COLUMN     "key" TEXT NOT NULL DEFAULT 'singleton';

-- CreateIndex
CREATE UNIQUE INDEX "OcrBatchState_key_key" ON "OcrBatchState"("key");
