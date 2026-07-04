-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "ocrScannedAt" TIMESTAMP(3),
ADD COLUMN     "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ImageTextRegion" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "readingOrder" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "ocrText" TEXT NOT NULL,
    "translatedText" TEXT,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT,
    "confidence" DOUBLE PRECISION,
    "angle" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTextRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrBatchState" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "processedPosts" INTEGER NOT NULL DEFAULT 0,
    "failedPosts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrBatchState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageTextRegion_postId_idx" ON "ImageTextRegion"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTextRegion_postId_readingOrder_key" ON "ImageTextRegion"("postId", "readingOrder");

-- CreateIndex
CREATE INDEX "Post_ocrStatus_idx" ON "Post"("ocrStatus");

-- AddForeignKey
ALTER TABLE "ImageTextRegion" ADD CONSTRAINT "ImageTextRegion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

