-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "imageSourceLanguage" TEXT,
ADD COLUMN     "imageTargetLanguage" TEXT,
ADD COLUMN     "imageTranslatedAt" TIMESTAMP(3),
ADD COLUMN     "imageTranslatedText" TEXT;
