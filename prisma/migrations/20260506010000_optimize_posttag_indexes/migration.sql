-- DropIndex
DROP INDEX IF EXISTS "PostTag_tagId_idx";

-- DropIndex
DROP INDEX IF EXISTS "PostTag_postId_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostTag_tagId_postId_idx" ON "PostTag"("tagId", "postId");
