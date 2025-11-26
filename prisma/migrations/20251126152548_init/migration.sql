-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('UNRATED', 'SAFE', 'QUESTIONABLE', 'EXPLICIT');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('GENERAL', 'ARTIST', 'CHARACTER', 'COPYRIGHT', 'META');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PIXIV', 'TWITTER', 'OTHER');

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "hydrusFileId" INTEGER NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "blurhash" TEXT,
    "rating" "Rating" NOT NULL DEFAULT 'UNRATED',
    "sourceUrls" TEXT[],
    "importedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostGroup" (
    "postId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostGroup_pkey" PRIMARY KEY ("postId","groupId")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" SERIAL NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_hydrusFileId_key" ON "Post"("hydrusFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_hash_key" ON "Post"("hash");

-- CreateIndex
CREATE INDEX "Post_rating_idx" ON "Post"("rating");

-- CreateIndex
CREATE INDEX "Post_importedAt_idx" ON "Post"("importedAt");

-- CreateIndex
CREATE INDEX "Post_mimeType_idx" ON "Post"("mimeType");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_category_key" ON "Tag"("name", "category");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE INDEX "Group_sourceType_idx" ON "Group"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Group_sourceType_sourceId_key" ON "Group"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PostGroup_groupId_idx" ON "PostGroup"("groupId");

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostGroup" ADD CONSTRAINT "PostGroup_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostGroup" ADD CONSTRAINT "PostGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
