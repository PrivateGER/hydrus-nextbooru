-- DropIndex
DROP INDEX "Tag_name_trgm_idx";

-- CreateIndex
CREATE INDEX "PostTag_postId_idx" ON "PostTag"("postId");
