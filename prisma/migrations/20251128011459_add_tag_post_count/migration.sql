-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "postCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Tag_postCount_idx" ON "Tag"("postCount" DESC);
