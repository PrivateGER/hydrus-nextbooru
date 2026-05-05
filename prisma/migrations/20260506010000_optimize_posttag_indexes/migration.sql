-- DropIndex
DROP INDEX "PostTag_tagId_idx";

-- DropIndex
DROP INDEX "PostTag_postId_idx";

-- CreateIndex
CREATE INDEX "PostTag_tagId_postId_idx" ON "PostTag"("tagId", "postId");
