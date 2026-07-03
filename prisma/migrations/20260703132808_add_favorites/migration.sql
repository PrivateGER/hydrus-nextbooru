-- CreateTable
CREATE TABLE "Favorite" (
    "postId" INTEGER NOT NULL,
    "favoritedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "FeedDismissal" (
    "postId" INTEGER NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedDismissal_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE INDEX "Favorite_favoritedAt_idx" ON "Favorite"("favoritedAt" DESC);

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedDismissal" ADD CONSTRAINT "FeedDismissal_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
