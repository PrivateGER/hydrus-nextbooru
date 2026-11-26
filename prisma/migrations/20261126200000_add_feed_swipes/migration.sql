-- Outcome of each card in the swipe feed: latest swipe per post, and whether
-- it was dealt as an exploration card.

-- CreateEnum
CREATE TYPE "FeedSwipeAction" AS ENUM ('LIKE', 'SKIP');

-- CreateTable
CREATE TABLE "FeedSwipe" (
    "postId" INTEGER NOT NULL,
    "action" "FeedSwipeAction" NOT NULL,
    "explore" BOOLEAN NOT NULL DEFAULT false,
    "swipedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSwipe_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE INDEX "FeedSwipe_swipedAt_idx" ON "FeedSwipe"("swipedAt" DESC);

-- AddForeignKey
ALTER TABLE "FeedSwipe" ADD CONSTRAINT "FeedSwipe_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
