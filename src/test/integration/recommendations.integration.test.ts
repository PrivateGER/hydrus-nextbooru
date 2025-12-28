import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags, createGroup, createPostInGroup, createPost, createTag } from './factories';
import { TagCategory, SourceType } from '@/generated/prisma/client';

let getRecommendations: typeof import('@/lib/recommendations').getRecommendations;
let getRecommendationsByHash: typeof import('@/lib/recommendations').getRecommendationsByHash;
let computeRecommendationsForPost: typeof import('@/lib/recommendations').computeRecommendationsForPost;
let pregenRecommendations: typeof import('@/lib/recommendations').pregenRecommendations;
let hasRecommendations: typeof import('@/lib/recommendations').hasRecommendations;
let getRecommendationStats: typeof import('@/lib/recommendations').getRecommendationStats;

describe('Recommendations Module (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/lib/recommendations');
    getRecommendations = module.getRecommendations;
    getRecommendationsByHash = module.getRecommendationsByHash;
    computeRecommendationsForPost = module.computeRecommendationsForPost;
    pregenRecommendations = module.pregenRecommendations;
    hasRecommendations = module.hasRecommendations;
    getRecommendationStats = module.getRecommendationStats;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('computeRecommendationsForPost', () => {
    it('should return empty when no posts share tags', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['tag-a', 'tag-b']);
      await createPostWithTags(prisma, ['tag-c', 'tag-d']);

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(post1.id, 10);

      expect(recommendations).toEqual([]);
    });

    it('should recommend posts with shared tags', async () => {
      const prisma = getTestPrisma();

      // Create posts with shared and unique tags
      // Need at least 3 posts so IDF is meaningful (ln(3/2) > 0)
      const post1 = await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      const post2 = await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      await createPostWithTags(prisma, ['other-tag']); // Third post with different tag

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(post1.id, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].recommendedId).toBe(post2.id);
      expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should rank posts with more shared tags higher', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['tag-a', 'tag-b', 'tag-c']);
      const post2 = await createPostWithTags(prisma, ['tag-a']); // 1 shared tag
      const post3 = await createPostWithTags(prisma, ['tag-a', 'tag-b']); // 2 shared tags

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(post1.id, 10);

      expect(recommendations).toHaveLength(2);
      // Post with more shared tags should be first
      expect(recommendations[0].recommendedId).toBe(post3.id);
      expect(recommendations[1].recommendedId).toBe(post2.id);
      expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
    });

    it('should exclude posts in the same group', async () => {
      const prisma = getTestPrisma();

      // Create a group with two posts that share tags
      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post1 = await createPostInGroup(prisma, group, 0);
      const post2 = await createPostInGroup(prisma, group, 1);

      // Add the same tag to both
      const sharedTag = await createTag(prisma, 'shared-tag');
      await prisma.postTag.createMany({
        data: [
          { postId: post1.id, tagId: sharedTag.id },
          { postId: post2.id, tagId: sharedTag.id },
        ],
      });

      // Create a third post NOT in the group but with the same tag
      const post3 = await createPostWithTags(prisma, ['shared-tag']);

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(post1.id, 10);

      // Should only recommend post3, not post2 (which is in the same group)
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].recommendedId).toBe(post3.id);
    });

    it('should respect limit parameter', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);

      // Create 5 posts with the shared tag
      for (let i = 0; i < 5; i++) {
        await createPostWithTags(prisma, ['shared-tag', `unique-${i}`]);
      }

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(post1.id, 3);

      expect(recommendations).toHaveLength(3);
    });

    it('should weight rare tags higher (IDF)', async () => {
      const prisma = getTestPrisma();

      // Source post has both a common and rare tag
      const sourcePost = await createPostWithTags(prisma, ['common-tag', 'rare-tag']);

      // Create posts with common tag only (appears on 5 posts total including source)
      for (let i = 0; i < 4; i++) {
        await createPostWithTags(prisma, ['common-tag']);
      }

      // Create post with rare tag only (appears on 2 posts total including source)
      const rarePost = await createPostWithTags(prisma, ['rare-tag']);

      // Create post with both tags - should have highest score
      const bothPost = await createPostWithTags(prisma, ['common-tag', 'rare-tag']);

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const recommendations = await computeRecommendationsForPost(sourcePost.id, 10);

      // bothPost should be ranked highest (has both tags)
      // rarePost should be ranked higher than posts with only common tag
      const bothIndex = recommendations.findIndex(r => r.recommendedId === bothPost.id);
      const rareIndex = recommendations.findIndex(r => r.recommendedId === rarePost.id);

      expect(bothIndex).toBe(0); // Best match should be first
      expect(rareIndex).toBeGreaterThan(0); // Rare tag match should be after both-tag match
      expect(rareIndex).toBeLessThan(5); // But should be in top 5 (above common-only posts)
    });
  });

  describe('pregenRecommendations', () => {
    it('should generate recommendations for all posts', async () => {
      const prisma = getTestPrisma();

      // Create posts with shared tags
      await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      await createPostWithTags(prisma, ['shared-tag', 'unique-c']);

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      const result = await pregenRecommendations(10, 100);

      expect(result.processed).toBe(3);
      expect(result.total).toBe(3);

      // Check that recommendations were stored
      const storedRecs = await prisma.postRecommendation.count();
      expect(storedRecs).toBeGreaterThan(0);
    });

    it('should clear existing recommendations before regenerating', async () => {
      const prisma = getTestPrisma();

      // Create initial posts
      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      const post2 = await createPostWithTags(prisma, ['shared-tag']);

      // Recalculate tag counts
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;

      // Run pregen
      await pregenRecommendations(10, 100);

      const count1 = await prisma.postRecommendation.count();
      expect(count1).toBeGreaterThan(0);

      // Run pregen again
      await pregenRecommendations(10, 100);

      const count2 = await prisma.postRecommendation.count();

      // Count should be the same (not doubled)
      expect(count2).toBe(count1);
    });
  });

  describe('getRecommendations', () => {
    it('should return cached recommendations', async () => {
      const prisma = getTestPrisma();

      // Need at least 3 posts so IDF is meaningful
      const post1 = await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      const post2 = await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      await createPostWithTags(prisma, ['other-tag']); // Third post with different tag

      // Recalculate tag counts and generate recommendations
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;
      await pregenRecommendations(10, 100);

      const recommendations = await getRecommendations(post1.id, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].hash).toBe(post2.hash);
      expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should return empty array if no recommendations exist', async () => {
      const prisma = getTestPrisma();

      const post = await createPost(prisma);

      const recommendations = await getRecommendations(post.id, 10);

      expect(recommendations).toEqual([]);
    });
  });

  describe('getRecommendationsByHash', () => {
    it('should return recommendations by hash', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      const post2 = await createPostWithTags(prisma, ['shared-tag']);

      // Recalculate tag counts and generate recommendations
      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;
      await pregenRecommendations(10, 100);

      const recommendations = await getRecommendationsByHash(post1.hash, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].hash).toBe(post2.hash);
    });

    it('should return empty array for non-existent hash', async () => {
      const recommendations = await getRecommendationsByHash('0'.repeat(64), 10);

      expect(recommendations).toEqual([]);
    });
  });

  describe('hasRecommendations', () => {
    it('should return false when no recommendations exist', async () => {
      const result = await hasRecommendations();
      expect(result).toBe(false);
    });

    it('should return true when recommendations exist', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, ['shared-tag']);
      await createPostWithTags(prisma, ['shared-tag']);

      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;
      await pregenRecommendations(10, 100);

      const result = await hasRecommendations();
      expect(result).toBe(true);
    });
  });

  describe('getRecommendationStats', () => {
    it('should return correct statistics', async () => {
      const prisma = getTestPrisma();

      // Create 3 posts with shared tags
      await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      await createPostWithTags(prisma, ['shared-tag', 'unique-c']);

      await prisma.$executeRaw`
        UPDATE "Tag" t SET "postCount" = (
          SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
        )
      `;
      await pregenRecommendations(10, 100);

      const stats = await getRecommendationStats();

      // Each post should have 2 recommendations (the other 2 posts)
      expect(stats.totalRecommendations).toBe(6); // 3 posts × 2 recommendations each
      expect(stats.postsWithRecommendations).toBe(3);
    });
  });
});
