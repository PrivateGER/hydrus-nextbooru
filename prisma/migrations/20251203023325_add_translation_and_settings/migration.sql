-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "sourceLanguage" TEXT,
ADD COLUMN     "targetLanguage" TEXT,
ADD COLUMN     "translatedAt" TIMESTAMP(3),
ADD COLUMN     "translatedContent" TEXT;

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");
