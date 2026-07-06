-- Implicit engagement signal for the "For You" feed: one row per viewed post,
-- tracking how many times and how recently the post's detail page was opened.
CREATE TABLE "PostView" (
    "postId" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("postId")
);

-- Feed reads the most-recently-viewed posts first as seed candidates.
CREATE INDEX "PostView_lastViewedAt_idx" ON "PostView"("lastViewedAt" DESC);

ALTER TABLE "PostView"
    ADD CONSTRAINT "PostView_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
