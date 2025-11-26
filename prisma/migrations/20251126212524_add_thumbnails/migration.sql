-- CreateEnum
CREATE TYPE "ThumbnailSize" AS ENUM ('GRID', 'PREVIEW');

-- CreateEnum
CREATE TYPE "ThumbnailStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Thumbnail" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "size" "ThumbnailSize" NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Thumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thumbnail_postId_idx" ON "Thumbnail"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Thumbnail_postId_size_key" ON "Thumbnail"("postId", "size");

-- AddForeignKey
ALTER TABLE "Thumbnail" ADD CONSTRAINT "Thumbnail_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
