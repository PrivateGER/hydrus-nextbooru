import type * as RecommendationsModule from '@/lib/recommendations';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase, recalculateTagStats } from './setup';
import { setTestPrisma } from '@/lib/db';
import {
  createPostWithTags,
  createGroup,
  createPostInGroup,
  createTag,
  createPostsBulk,
  createTagsBulk,
  linkPostsToTagsBulk,
} from './factories';
import { SourceType } from '@/generated/prisma/client';

let getOrComputeRecommendations: typeof RecommendationsModule.getOrComputeRecommendations;
let getOrComputeRecommendationsByHash: typeof RecommendationsModule.getOrComputeRecommendationsByHash;
let computeRecommendationsForPost: typeof RecommendationsModule.computeRecommendationsForPost;
let getTagNeighborhoodsForSeeds: typeof RecommendationsModule.getTagNeighborhoodsForSeeds;
let invalidateRecommendationsForPost: typeof RecommendationsModule.invalidateRecommendationsForPost;
let invalidateAllRecommendations: typeof RecommendationsModule.invalidateAllRecommendations;
let hasRecommendations: typeof RecommendationsModule.hasRecommendations;
let getRecommendationStats: typeof RecommendationsModule.getRecommendationStats;

describe('Recommendations Module (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const routeModule = await import('@/lib/recommendations');
    getOrComputeRecommendations = routeModule.getOrComputeRecommendations;
    getOrComputeRecommendationsByHash = routeModule.getOrComputeRecommendationsByHash;
    computeRecommendationsForPost = routeModule.computeRecommendationsForPost;
    getTagNeighborhoodsForSeeds = routeModule.getTagNeighborhoodsForSeeds;
    invalidateRecommendationsForPost = routeModule.invalidateRecommendationsForPost;
    invalidateAllRecommendations = routeModule.invalidateAllRecommendations;
    hasRecommendations = routeModule.hasRecommendations;
    getRecommendationStats = routeModule.getRecommendationStats;
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

    it('should cache top results independent of first request limit', async () => {
      const prisma = getTestPrisma();

      const source = await createPostWithTags(prisma, ['shared-tag', 'source-only']);
      for (let i = 0; i < 6; i++) {
        await createPostWithTags(prisma, ['shared-tag', `candidate-${i}`]);
      }

      await recalculateTagStats();

      const first = await getOrComputeRecommendations(source.id, 3);
      expect(first).toHaveLength(3);

      const cachedCount = await prisma.postRecommendation.count({ where: { postId: source.id } });
      expect(cachedCount).toBe(6);

      const firstComputedAt = await prisma.postRecommendation.findFirst({
        where: { postId: source.id },
        select: { computedAt: true },
      });

      const second = await getOrComputeRecommendations(source.id, 5);
      expect(second).toHaveLength(5);

      const secondComputedAt = await prisma.postRecommendation.findFirst({
        where: { postId: source.id },
        select: { computedAt: true },
      });
      expect(secondComputedAt?.computedAt.getTime()).toBe(firstComputedAt?.computedAt.getTime());
    });

    it('should handle concurrent cache population without unique constraint errors', async () => {
      const prisma = getTestPrisma();

      const source = await createPostWithTags(prisma, ['shared-tag']);
      for (let i = 0; i < 4; i++) {
        await createPostWithTags(prisma, ['shared-tag', `candidate-${i}`]);
      }

      await recalculateTagStats();

      const results = await Promise.all([
        getOrComputeRecommendations(source.id, 10),
        getOrComputeRecommendations(source.id, 10),
        getOrComputeRecommendations(source.id, 10),
      ]);

      expect(results[0]).toHaveLength(4);
      expect(results[1]).toHaveLength(4);
      expect(results[2]).toHaveLength(4);

      const cached = await prisma.postRecommendation.count({ where: { postId: source.id } });
      expect(cached).toBe(4);
    });
  });

  describe('distinctiveness floor', () => {
    it('keeps common tags active for small corpora in single and batch paths', async () => {
      const prisma = getTestPrisma();

      const singleSource = await createPostWithTags(prisma, ['small-common-tag', 'single-source']);
      const singleTarget = await createPostWithTags(prisma, ['small-common-tag', 'single-target']);
      const batchSource = await createPostWithTags(prisma, ['small-common-tag', 'batch-source']);
      const batchTarget = await createPostWithTags(prisma, ['small-common-tag', 'batch-target']);

      for (let i = 0; i < 6; i++) {
        await createPostWithTags(prisma, ['small-common-tag', `small-common-extra-${i}`]);
      }
      for (let i = 0; i < 10; i++) {
        await createPostWithTags(prisma, [`small-filler-${i}`]);
      }

      await recalculateTagStats();

      const singleRecommendations = await getOrComputeRecommendations(singleSource.id, 20);
      expect(singleRecommendations.map((post) => post.id)).toContain(singleTarget.id);

      const batchRecommendations = await getTagNeighborhoodsForSeeds([batchSource.id], 20);
      expect(batchRecommendations.get(batchSource.id)?.map((post) => post.id)).toContain(batchTarget.id);
    });

    it('prunes ubiquitous source tags for large corpora in single and batch paths', async () => {
      const prisma = getTestPrisma();

      const ubiquitousTag = await createTag(prisma, 'floor-ubiquitous-tag');
      const singleDistinctiveTag = await createTag(prisma, 'single-distinctive-tag');
      const singleMidTag = await createTag(prisma, 'single-mid-tag');
      const batchDistinctiveTag = await createTag(prisma, 'batch-distinctive-tag');
      const batchMidTag = await createTag(prisma, 'batch-mid-tag');

      const postIds = await createPostsBulk(prisma, 840, { hashSeed: 'distinctiveness-floor' });
      const [
        singleUbiquitousSourceId,
        singleUbiquitousOnlyCandidateId,
        singleRichSourceId,
        singleDistinctiveCandidateId,
        singleMidCandidateId,
        batchUbiquitousSourceId,
        batchUbiquitousOnlyCandidateId,
        batchRichSourceId,
        batchDistinctiveCandidateId,
        batchMidCandidateId,
      ] = postIds;

      await linkPostsToTagsBulk(prisma, [
        { postId: singleUbiquitousSourceId, tagId: ubiquitousTag.id },
        { postId: singleUbiquitousOnlyCandidateId, tagId: ubiquitousTag.id },
        { postId: singleRichSourceId, tagId: ubiquitousTag.id },
        { postId: singleRichSourceId, tagId: singleDistinctiveTag.id },
        { postId: singleRichSourceId, tagId: singleMidTag.id },
        { postId: singleDistinctiveCandidateId, tagId: singleDistinctiveTag.id },
        { postId: singleMidCandidateId, tagId: singleMidTag.id },
        { postId: batchUbiquitousSourceId, tagId: ubiquitousTag.id },
        { postId: batchUbiquitousOnlyCandidateId, tagId: ubiquitousTag.id },
        { postId: batchRichSourceId, tagId: ubiquitousTag.id },
        { postId: batchRichSourceId, tagId: batchDistinctiveTag.id },
        { postId: batchRichSourceId, tagId: batchMidTag.id },
        { postId: batchDistinctiveCandidateId, tagId: batchDistinctiveTag.id },
        { postId: batchMidCandidateId, tagId: batchMidTag.id },
        ...postIds.slice(10, 610).map((postId) => ({ postId, tagId: ubiquitousTag.id })),
        ...postIds.slice(610, 618).map((postId) => ({ postId, tagId: singleMidTag.id })),
        ...postIds.slice(618, 626).map((postId) => ({ postId, tagId: batchMidTag.id })),
      ]);

      await recalculateTagStats();

      const singleUbiquitousOnlyRecommendations = await getOrComputeRecommendations(singleUbiquitousSourceId, 20);
      expect(singleUbiquitousOnlyRecommendations).toEqual([]);

      const singleRichRecommendations = await getOrComputeRecommendations(singleRichSourceId, 20);
      const singleRichRecommendationIds = singleRichRecommendations.map((post) => post.id);
      expect(singleRichRecommendationIds).toContain(singleDistinctiveCandidateId);
      expect(singleRichRecommendationIds).toContain(singleMidCandidateId);
      expect(singleRichRecommendationIds).not.toContain(singleUbiquitousOnlyCandidateId);

      const batchRecommendations = await getTagNeighborhoodsForSeeds([
        batchUbiquitousSourceId,
        batchRichSourceId,
      ], 20);

      expect(batchRecommendations.get(batchUbiquitousSourceId)).toEqual([]);

      const batchRichRecommendationIds = batchRecommendations.get(batchRichSourceId)?.map((post) => post.id) ?? [];
      expect(batchRichRecommendationIds).toContain(batchDistinctiveCandidateId);
      expect(batchRichRecommendationIds).toContain(batchMidCandidateId);
      expect(batchRichRecommendationIds).not.toContain(batchUbiquitousOnlyCandidateId);
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
    it('should clear cached recommendations where post is source or target', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      const post2 = await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();

      // Generate recommendations in both directions
      await getOrComputeRecommendations(post1.id, 10);
      await getOrComputeRecommendations(post2.id, 10);

      const affectedBefore = await prisma.postRecommendation.count({
        where: {
          OR: [
            { postId: post1.id },
            { recommendedId: post1.id },
          ],
        },
      });
      expect(affectedBefore).toBeGreaterThan(0);

      // Invalidate
      await invalidateRecommendationsForPost(post1.id);

      const affectedAfter = await prisma.postRecommendation.count({
        where: {
          OR: [
            { postId: post1.id },
            { recommendedId: post1.id },
          ],
        },
      });
      expect(affectedAfter).toBe(0);
    });
  });

  describe('invalidateAllRecommendations', () => {
    it('should clear all cached recommendations', async () => {
      const prisma = getTestPrisma();

      const post1 = await createPostWithTags(prisma, ['shared-tag']);
      const post2 = await createPostWithTags(prisma, ['shared-tag']);
      const post3 = await createPostWithTags(prisma, ['shared-tag']);

      await recalculateTagStats();
      await getOrComputeRecommendations(post1.id, 10);
      await getOrComputeRecommendations(post2.id, 10);
      await getOrComputeRecommendations(post3.id, 10);

      const cachedBefore = await prisma.postRecommendation.count();
      expect(cachedBefore).toBeGreaterThan(0);

      await invalidateAllRecommendations();

      const cachedAfter = await prisma.postRecommendation.count();
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
