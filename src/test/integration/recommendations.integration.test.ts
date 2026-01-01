import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase, recalculateTagStats } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags, createGroup, createPostInGroup, createTag } from './factories';
import { SourceType } from '@/generated/prisma/client';

let getOrComputeRecommendations: typeof import('@/lib/recommendations').getOrComputeRecommendations;
let getOrComputeRecommendationsByHash: typeof import('@/lib/recommendations').getOrComputeRecommendationsByHash;
let computeRecommendationsForPost: typeof import('@/lib/recommendations').computeRecommendationsForPost;
let invalidateRecommendationsForPost: typeof import('@/lib/recommendations').invalidateRecommendationsForPost;
let hasRecommendations: typeof import('@/lib/recommendations').hasRecommendations;
let getRecommendationStats: typeof import('@/lib/recommendations').getRecommendationStats;

describe('Recommendations Module (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/lib/recommendations');
    getOrComputeRecommendations = module.getOrComputeRecommendations;
    getOrComputeRecommendationsByHash = module.getOrComputeRecommendationsByHash;
    computeRecommendationsForPost = module.computeRecommendationsForPost;
    invalidateRecommendationsForPost = module.invalidateRecommendationsForPost;
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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

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

  describe('getOrComputeRecommendations (JIT)', () => {
    it('should compute and cache recommendations on first call', async () => {
      const prisma = getTestPrisma();

      // Need at least 3 posts so IDF is meaningful
      const post1 = await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      const post2 = await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      await createPostWithTags(prisma, ['other-tag']); // Third post with different tag

      // Recalculate tag counts and IDF weights
      await recalculateTagStats();

      // No cached recommendations initially
      const cachedBefore = await prisma.postRecommendation.count({ where: { postId: post1.id } });
      expect(cachedBefore).toBe(0);

      // Call JIT function
      const recommendations = await getOrComputeRecommendations(post1.id, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].hash).toBe(post2.hash);
      expect(recommendations[0].score).toBeGreaterThan(0);

      // Should have cached the result
      const cachedAfter = await prisma.postRecommendation.count({ where: { postId: post1.id } });
      expect(cachedAfter).toBe(1);
    });

    it('should return cached results on subsequent calls', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      // Create another post with shared tag so recommendations have something to find
      await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();

      // First call - computes and caches
      const first = await getOrComputeRecommendations(post1.id, 10);
      expect(first).toHaveLength(1);

      // Get the cached timestamp
      const cached = await prisma.postRecommendation.findFirst({
        where: { postId: post1.id },
        select: { computedAt: true },
      });

      // Second call - should use cache
      const second = await getOrComputeRecommendations(post1.id, 10);
      expect(second).toHaveLength(1);

      // Verify cache wasn't regenerated (same timestamp)
      const cachedAfter = await prisma.postRecommendation.findFirst({
        where: { postId: post1.id },
        select: { computedAt: true },
      });
      expect(cachedAfter?.computedAt.getTime()).toBe(cached?.computedAt.getTime());
    });

    it('should return empty array and clean cache if no recommendations', async () => {
      const prisma = getTestPrisma();

      // Create post with no shared tags
      const post1 = await createPostWithTags(prisma, ['unique-tag-a']);
      await createPostWithTags(prisma, ['unique-tag-b']);

      await recalculateTagStats();

      const recommendations = await getOrComputeRecommendations(post1.id, 10);

      expect(recommendations).toEqual([]);

      // Should have no cached entries
      const cached = await prisma.postRecommendation.count({ where: { postId: post1.id } });
      expect(cached).toBe(0);
    });
  });

  describe('getOrComputeRecommendationsByHash', () => {
    it('should compute recommendations by hash', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      const post2 = await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();

      const recommendations = await getOrComputeRecommendationsByHash(post1.hash, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].hash).toBe(post2.hash);
    });

    it('should return empty array for non-existent hash', async () => {
      const recommendations = await getOrComputeRecommendationsByHash('0'.repeat(64), 10);

      expect(recommendations).toEqual([]);
    });
  });

  describe('invalidateRecommendationsForPost', () => {
    it('should clear cached recommendations for a post', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();

      // Generate recommendations
      await getOrComputeRecommendations(post1.id, 10);

      // Verify cached
      const cachedBefore = await prisma.postRecommendation.count({ where: { postId: post1.id } });
      expect(cachedBefore).toBe(1);

      // Invalidate
      await invalidateRecommendationsForPost(post1.id);

      // Verify cleared
      const cachedAfter = await prisma.postRecommendation.count({ where: { postId: post1.id } });
      expect(cachedAfter).toBe(0);
    });
  });

  describe('hasRecommendations', () => {
    it('should return false when no recommendations exist', async () => {
      const result = await hasRecommendations();
      expect(result).toBe(false);
    });

    it('should return true when recommendations exist', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();
      await getOrComputeRecommendations(post1.id, 10);

      const result = await hasRecommendations();
      expect(result).toBe(true);
    });
  });

  describe('getRecommendationStats', () => {
    it('should return correct statistics', async () => {
      const prisma = getTestPrisma();

      // Create 3 posts with shared tags
      const post1 = await createPostWithTags(prisma, ['shared-tag', 'unique-a']);
      const post2 = await createPostWithTags(prisma, ['shared-tag', 'unique-b']);
      const post3 = await createPostWithTags(prisma, ['shared-tag', 'unique-c']);

      await recalculateTagStats();

      // Trigger JIT for all posts
      await getOrComputeRecommendations(post1.id, 10);
      await getOrComputeRecommendations(post2.id, 10);
      await getOrComputeRecommendations(post3.id, 10);

      const stats = await getRecommendationStats();

      // Each post should have 2 recommendations (the other 2 posts)
      expect(stats.totalRecommendations).toBe(6); // 3 posts × 2 recommendations each
      expect(stats.postsWithRecommendations).toBe(3);
    });
  });
});
