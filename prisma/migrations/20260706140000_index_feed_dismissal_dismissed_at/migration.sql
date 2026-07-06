-- The "For You" feed reads the most-recent dismissals as negative seeds
-- (ORDER BY "dismissedAt" DESC LIMIT negativeSeedCount). Index it so that read
-- is a bounded index scan instead of a full sort, mirroring the favoritedAt /
-- lastViewedAt indexes on Favorite / PostView.
CREATE INDEX "FeedDismissal_dismissedAt_idx" ON "FeedDismissal"("dismissedAt" DESC);
