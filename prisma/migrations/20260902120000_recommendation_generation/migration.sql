ALTER TABLE "PostRecommendation"
ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;

DELETE FROM "PostRecommendation";

DROP INDEX "PostRecommendation_postId_computedAt_idx";

CREATE INDEX "PostRecommendation_postId_generation_idx"
ON "PostRecommendation"("postId", "generation");

-- The cache-write fence share-locks this row; seed it so the very first bump
-- cannot slip between a writer's read and its write on an absent row.
INSERT INTO "Settings" ("key", "value", "updatedAt")
VALUES ('recommendations.tagStatsGeneration', '0', NOW())
ON CONFLICT ("key") DO NOTHING;
