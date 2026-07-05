-- AlterTable
ALTER TABLE "ImageTextRegion" ADD COLUMN     "hasCrop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "textColorBg" TEXT,
ADD COLUMN     "textColorFg" TEXT;

