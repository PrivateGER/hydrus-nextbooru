import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, createGroup, createPostInGroup, createTag } from './factories';
import { SourceType, TagCategory } from '@/generated/prisma/client';
import { createHash } from 'crypto';
import { Pool } from 'pg';

let searchGroups: typeof import('@/lib/groups').searchGroups;
let getGroupTypeCounts: typeof import('@/lib/groups').getGroupTypeCounts;

function withRawQueryCounter(prisma: ReturnType<typeof getTestPrisma>): {
  prisma: ReturnType<typeof getTestPrisma>;
  getRawQueryCount: () => number;
} {
  let rawQueryCount = 0;

  const proxy = new Proxy(prisma, {
    get(target, prop, receiver) {
      if (prop === '$queryRaw') {
        const queryRaw = target.$queryRaw.bind(target) as (...args: unknown[]) => unknown;
        return (...args: unknown[]) => {
          rawQueryCount += 1;
          return queryRaw(...args);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as ReturnType<typeof getTestPrisma>;

  return {
    prisma: proxy,
    getRawQueryCount: () => rawQueryCount,
  };
}

function expectedMemberHash(postIds: number[]): string {
  return createHash('md5')
    .update([...postIds].sort((a, b) => a - b).join(','))
    .digest('hex');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackendLockWait(prisma: ReturnType<typeof getTestPrisma>, pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [activity] = await prisma.$queryRaw<Array<{
      waitEventType: string | null;
      waitEvent: string | null;
    }>>`
      SELECT wait_event_type AS "waitEventType", wait_event AS "waitEvent"
      FROM pg_stat_activity
      WHERE pid = ${pid}
    `;

    if (activity?.waitEventType === 'Lock') {
      return;
    }

    await sleep(10);
  }

  throw new Error(`Backend ${pid} did not wait on a lock`);
}

describe('Groups Module (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const routeModule = await import('@/lib/groups');
    searchGroups = routeModule.searchGroups;
    getGroupTypeCounts = routeModule.getGroupTypeCounts;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('searchGroups', () => {
    it('should return empty when no groups exist', async () => {
      const prisma = getTestPrisma();
      const result = await searchGroups({}, prisma);

      expect(result.groups).toEqual([]);
      expect(result.totalGroups).toBe(0);
      expect(result.filteredCount).toBe(0);
      expect(result.mergedTotal).toBe(0);
    });

    it('should only return groups with 2+ posts', async () => {
      const prisma = getTestPrisma();

      // Group with 1 post - should NOT be returned
      const group1 = await createGroup(prisma, SourceType.PIXIV, '12345');
      await createPostInGroup(prisma, group1, 0);

      // Group with 2 posts - should be returned
      const group2 = await createGroup(prisma, SourceType.PIXIV, '67890');
      await createPostInGroup(prisma, group2, 0);
      await createPostInGroup(prisma, group2, 1);

      const result = await searchGroups({}, prisma);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groups[0].sourceId).toBe('67890');
      expect(result.groups[0].postCount).toBe(2);
    });

    it('should merge groups with identical posts', async () => {
      const prisma = getTestPrisma();

      // Create two posts
      const post1 = await createPost(prisma);
      const post2 = await createPost(prisma);

      // Create two groups with the same posts (e.g., Pixiv and Twitter links to same content)
      const pixivGroup = await createGroup(prisma, SourceType.PIXIV, '111');
      const twitterGroup = await createGroup(prisma, SourceType.TWITTER, '222');

      // Add same posts to both groups
      await prisma.postGroup.create({
        data: { postId: post1.id, groupId: pixivGroup.id, position: 0 },
      });
      await prisma.postGroup.create({
        data: { postId: post2.id, groupId: pixivGroup.id, position: 1 },
      });
      await prisma.postGroup.create({
        data: { postId: post1.id, groupId: twitterGroup.id, position: 0 },
      });
      await prisma.postGroup.create({
        data: { postId: post2.id, groupId: twitterGroup.id, position: 1 },
      });

      const result = await searchGroups({}, prisma);

      // Should be merged into 1 result
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groups).toHaveLength(2);

      const sourceTypes = result.groups[0].groups.map(g => g.sourceType);
      expect(sourceTypes).toContain(SourceType.PIXIV);
      expect(sourceTypes).toContain(SourceType.TWITTER);
    });

    it('should not merge groups with different posts', async () => {
      const prisma = getTestPrisma();

      // Group 1 with posts A, B
      const group1 = await createGroup(prisma, SourceType.PIXIV, '111');
      await createPostInGroup(prisma, group1, 0);
      await createPostInGroup(prisma, group1, 1);

      // Group 2 with posts C, D (different)
      const group2 = await createGroup(prisma, SourceType.PIXIV, '222');
      await createPostInGroup(prisma, group2, 0);
      await createPostInGroup(prisma, group2, 1);

      const result = await searchGroups({}, prisma);

      expect(result.groups).toHaveLength(2);
    });

    describe('type filtering', () => {
      it('should filter by source type', async () => {
        const prisma = getTestPrisma();

        const pixivGroup = await createGroup(prisma, SourceType.PIXIV, '111');
        await createPostInGroup(prisma, pixivGroup, 0);
        await createPostInGroup(prisma, pixivGroup, 1);

        const twitterGroup = await createGroup(prisma, SourceType.TWITTER, '222');
        await createPostInGroup(prisma, twitterGroup, 0);
        await createPostInGroup(prisma, twitterGroup, 1);

        const result = await searchGroups({ typeFilter: SourceType.PIXIV }, prisma);

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].groups[0].sourceType).toBe(SourceType.PIXIV);
      });
    });

    describe('search filtering', () => {
      it('should search source IDs case-insensitively', async () => {
        const prisma = getTestPrisma();

        const matchingGroup = await createGroup(prisma, SourceType.PIXIV, 'Pixiv-Target-777');
        await createPostInGroup(prisma, matchingGroup, 0);
        await createPostInGroup(prisma, matchingGroup, 1);

        const otherGroup = await createGroup(prisma, SourceType.PIXIV, 'unrelated-888');
        await createPostInGroup(prisma, otherGroup, 0);
        await createPostInGroup(prisma, otherGroup, 1);

        const result = await searchGroups({ query: 'target-777' }, prisma);

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].groups[0].sourceId).toBe('Pixiv-Target-777');
        expect(result.filteredCount).toBe(1);
      });

      it('should search original and translated group titles', async () => {
        const prisma = getTestPrisma();

        const originalTitleGroup = await createGroup(prisma, SourceType.TITLE, 'title-hash-1', 'Original Collection');
        await createPostInGroup(prisma, originalTitleGroup, 0);
        await createPostInGroup(prisma, originalTitleGroup, 1);

        const translatedTitle = 'Translated Anthology';
        const translatedTitleGroup = await createGroup(prisma, SourceType.TITLE, 'title-hash-2', '日本語タイトル');
        await prisma.contentTranslation.create({
          data: {
            contentHash: createHash('sha256').update('日本語タイトル', 'utf8').digest('hex'),
            translatedContent: translatedTitle,
          },
        });
        await createPostInGroup(prisma, translatedTitleGroup, 0);
        await createPostInGroup(prisma, translatedTitleGroup, 1);

        const originalResult = await searchGroups({ query: 'original collection' }, prisma);
        const translatedResult = await searchGroups({ query: 'anthology' }, prisma);

        expect(originalResult.groups).toHaveLength(1);
        expect(originalResult.groups[0].groups[0].sourceId).toBe('title-hash-1');
        expect(translatedResult.groups).toHaveLength(1);
        expect(translatedResult.groups[0].groups[0].translatedTitle).toBe(translatedTitle);
      });

      it('should search valid creators and ignore invalid creator names', async () => {
        const prisma = getTestPrisma();

        const validArtist = await createTag(prisma, 'studio_artist', TagCategory.ARTIST);
        const invalidArtist = await createTag(prisma, 'user abcd1234', TagCategory.ARTIST);

        const validGroup = await createGroup(prisma, SourceType.PIXIV, 'valid-creator-group');
        const validPost = await createPostInGroup(prisma, validGroup, 0);
        await createPostInGroup(prisma, validGroup, 1);
        await prisma.postTag.create({ data: { postId: validPost.id, tagId: validArtist.id } });

        const invalidGroup = await createGroup(prisma, SourceType.PIXIV, 'invalid-creator-group');
        const invalidPost = await createPostInGroup(prisma, invalidGroup, 0);
        await createPostInGroup(prisma, invalidGroup, 1);
        await prisma.postTag.create({ data: { postId: invalidPost.id, tagId: invalidArtist.id } });

        const validResult = await searchGroups({ query: 'studio' }, prisma);
        const invalidResult = await searchGroups({ query: 'abcd1234' }, prisma);

        expect(validResult.groups).toHaveLength(1);
        expect(validResult.groups[0].groups[0].sourceId).toBe('valid-creator-group');
        expect(invalidResult.groups).toHaveLength(0);
        expect(invalidResult.filteredCount).toBe(0);
      });
    });

    describe('creator filtering', () => {
      it('should filter by creators from posts beyond the preview limit', async () => {
        const prisma = getTestPrisma();

        const lateArtist = await createTag(prisma, 'late_filter_artist', TagCategory.ARTIST);
        const matchingGroup = await createGroup(prisma, SourceType.PIXIV, 'large-filter-group');
        let lateArtistPostId = 0;

        for (let position = 0; position < 11; position++) {
          const post = await createPostInGroup(prisma, matchingGroup, position);
          if (position === 10) {
            lateArtistPostId = post.id;
            await prisma.postTag.create({ data: { postId: post.id, tagId: lateArtist.id } });
          }
        }

        const otherGroup = await createGroup(prisma, SourceType.PIXIV, 'other-filter-group');
        await createPostInGroup(prisma, otherGroup, 0);
        await createPostInGroup(prisma, otherGroup, 1);

        const result = await searchGroups({ creatorFilter: 'late_filter' }, prisma);

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].groups[0].sourceId).toBe('large-filter-group');
        expect(result.groups[0].posts.map((post) => post.postId)).not.toContain(lateArtistPostId);
        expect(result.groups[0].creators).toContain('late_filter_artist');
      });

      it('should combine creator filtering with source-type filtering and pagination counts', async () => {
        const prisma = getTestPrisma();

        const artist = await createTag(prisma, 'shared_filter_artist', TagCategory.ARTIST);

        for (let index = 0; index < 3; index++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `pixiv-match-${index}`);
          const post = await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
          await prisma.postTag.create({ data: { postId: post.id, tagId: artist.id } });
        }

        const twitterGroup = await createGroup(prisma, SourceType.TWITTER, 'twitter-match');
        const twitterPost = await createPostInGroup(prisma, twitterGroup, 0);
        await createPostInGroup(prisma, twitterGroup, 1);
        await prisma.postTag.create({ data: { postId: twitterPost.id, tagId: artist.id } });

        const nonMatchingPixivGroup = await createGroup(prisma, SourceType.PIXIV, 'pixiv-without-artist');
        await createPostInGroup(prisma, nonMatchingPixivGroup, 0);
        await createPostInGroup(prisma, nonMatchingPixivGroup, 1);

        const result = await searchGroups({
          typeFilter: SourceType.PIXIV,
          creatorFilter: 'shared_filter',
          pageSize: 2,
          page: 1,
          order: 'oldest',
        }, prisma);

        expect(result.groups).toHaveLength(2);
        expect(result.groups.every((group) => group.groups[0].sourceType === SourceType.PIXIV)).toBe(true);
        expect(result.filteredCount).toBe(3);
        // mergedTotal is the unfiltered population (3 pixiv-match + 1 twitter + 1 pixiv-without-artist),
        // so it must NOT shrink with the active type/creator filters.
        expect(result.mergedTotal).toBe(5);
        expect(result.totalPages).toBe(2);
      });

      it('should avoid an extra merged-total query on filtered first pages', async () => {
        const prisma = getTestPrisma();
        const artist = await createTag(prisma, 'perf_filter_artist', TagCategory.ARTIST);

        for (let index = 0; index < 3; index++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `perf-match-${index}`);
          const post = await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
          await prisma.postTag.create({ data: { postId: post.id, tagId: artist.id } });
        }

        const { prisma: countedPrisma, getRawQueryCount } = withRawQueryCounter(prisma);

        const result = await searchGroups({
          creatorFilter: 'perf_filter',
          order: 'oldest',
          pageSize: 2,
        }, countedPrisma);

        expect(result.groups).toHaveLength(2);
        expect(result.filteredCount).toBe(3);
        expect(result.mergedTotal).toBe(3);
        expect(getRawQueryCount()).toBeLessThanOrEqual(4);
      });
    });

    describe('ordering', () => {
      it('should order by newest (highest group ID first)', async () => {
        const prisma = getTestPrisma();

        const group1 = await createGroup(prisma, SourceType.PIXIV, '111');
        await createPostInGroup(prisma, group1, 0);
        await createPostInGroup(prisma, group1, 1);

        const group2 = await createGroup(prisma, SourceType.PIXIV, '222');
        await createPostInGroup(prisma, group2, 0);
        await createPostInGroup(prisma, group2, 1);

        const result = await searchGroups({ order: 'newest' }, prisma);

        expect(result.groups[0].groups[0].sourceId).toBe('222');
        expect(result.groups[1].groups[0].sourceId).toBe('111');
      });

      it('should order by oldest (lowest group ID first)', async () => {
        const prisma = getTestPrisma();

        const group1 = await createGroup(prisma, SourceType.PIXIV, '111');
        await createPostInGroup(prisma, group1, 0);
        await createPostInGroup(prisma, group1, 1);

        const group2 = await createGroup(prisma, SourceType.PIXIV, '222');
        await createPostInGroup(prisma, group2, 0);
        await createPostInGroup(prisma, group2, 1);

        const result = await searchGroups({ order: 'oldest' }, prisma);

        expect(result.groups[0].groups[0].sourceId).toBe('111');
        expect(result.groups[1].groups[0].sourceId).toBe('222');
      });

      it('should order by largest (most posts first)', async () => {
        const prisma = getTestPrisma();

        // Group with 2 posts
        const smallGroup = await createGroup(prisma, SourceType.PIXIV, 'small');
        await createPostInGroup(prisma, smallGroup, 0);
        await createPostInGroup(prisma, smallGroup, 1);

        // Group with 4 posts
        const largeGroup = await createGroup(prisma, SourceType.PIXIV, 'large');
        await createPostInGroup(prisma, largeGroup, 0);
        await createPostInGroup(prisma, largeGroup, 1);
        await createPostInGroup(prisma, largeGroup, 2);
        await createPostInGroup(prisma, largeGroup, 3);

        const result = await searchGroups({ order: 'largest' }, prisma);

        expect(result.groups[0].groups[0].sourceId).toBe('large');
        expect(result.groups[0].postCount).toBe(4);
        expect(result.groups[1].groups[0].sourceId).toBe('small');
        expect(result.groups[1].postCount).toBe(2);
      });

      it('should order randomly with same seed producing same order', async () => {
        const prisma = getTestPrisma();

        for (let i = 0; i < 5; i++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `group-${i}`);
          await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
        }

        const seed = 'test-seed-123';
        const result1 = await searchGroups({ order: 'random', seed }, prisma);
        const result2 = await searchGroups({ order: 'random', seed }, prisma);

        const ids1 = result1.groups.map(g => g.contentHash);
        const ids2 = result2.groups.map(g => g.contentHash);

        expect(ids1).toEqual(ids2);
      });

      it('should order randomly with different seed producing different order', async () => {
        const prisma = getTestPrisma();

        for (let i = 0; i < 10; i++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `group-${i}`);
          await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
        }

        const result1 = await searchGroups({ order: 'random', seed: 'seed-a' }, prisma);
        const result2 = await searchGroups({ order: 'random', seed: 'seed-b' }, prisma);

        const ids1 = result1.groups.map(g => g.contentHash);
        const ids2 = result2.groups.map(g => g.contentHash);

        // With 10 items, different seeds should produce different orderings
        expect(ids1).not.toEqual(ids2);
      });
    });

    describe('pagination', () => {
      it('should paginate results', async () => {
        const prisma = getTestPrisma();

        for (let i = 0; i < 5; i++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `group-${i}`);
          await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
        }

        const result = await searchGroups({ pageSize: 2, page: 1, order: 'oldest' }, prisma);

        expect(result.groups).toHaveLength(2);
        expect(result.filteredCount).toBe(5);
        expect(result.totalPages).toBe(3);
        expect(result.page).toBe(1);
      });

      it('should return different groups on different pages', async () => {
        const prisma = getTestPrisma();

        for (let i = 0; i < 4; i++) {
          const group = await createGroup(prisma, SourceType.PIXIV, `group-${i}`);
          await createPostInGroup(prisma, group, 0);
          await createPostInGroup(prisma, group, 1);
        }

        const page1 = await searchGroups({ pageSize: 2, page: 1, order: 'oldest' }, prisma);
        const page2 = await searchGroups({ pageSize: 2, page: 2, order: 'oldest' }, prisma);

        const hashes1 = page1.groups.map(g => g.contentHash);
        const hashes2 = page2.groups.map(g => g.contentHash);

        expect(hashes1).not.toEqual(hashes2);
        expect([...hashes1, ...hashes2]).toHaveLength(4);
      });
    });

    describe('cached member stats', () => {
      it('should maintain cached member count and hash when group membership changes', async () => {
        const prisma = getTestPrisma();
        const group = await createGroup(prisma, SourceType.PIXIV, 'cached-stats-group');

        const firstPost = await createPostInGroup(prisma, group, 0);
        const secondPost = await createPostInGroup(prisma, group, 1);

        const [initialStats] = await prisma.$queryRaw<Array<{
          memberCount: number;
          memberHash: string | null;
        }>>`
          SELECT "memberCount", "memberHash"
          FROM "Group"
          WHERE id = ${group.id}
        `;

        expect(initialStats).toEqual({
          memberCount: 2,
          memberHash: expectedMemberHash([firstPost.id, secondPost.id]),
        });

        await prisma.postGroup.delete({
          where: {
            postId_groupId: {
              postId: secondPost.id,
              groupId: group.id,
            },
          },
        });

        const [updatedStats] = await prisma.$queryRaw<Array<{
          memberCount: number;
          memberHash: string | null;
        }>>`
          SELECT "memberCount", "memberHash"
          FROM "Group"
          WHERE id = ${group.id}
        `;

        expect(updatedStats).toEqual({
          memberCount: 1,
          memberHash: expectedMemberHash([firstPost.id]),
        });
      });

      it('should serialize concurrent member stat refreshes for the same group', async () => {
        const prisma = getTestPrisma();
        const group = await createGroup(prisma, SourceType.PIXIV, 'concurrent-cached-stats-group');
        const firstPost = await createPost(prisma);
        const secondPost = await createPost(prisma);

        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const firstClient = await pool.connect();
        const secondClient = await pool.connect();

        try {
          await firstClient.query('BEGIN');
          await firstClient.query(
            'INSERT INTO "PostGroup" ("postId", "groupId", position) VALUES ($1, $2, 0)',
            [firstPost.id, group.id]
          );

          await secondClient.query('BEGIN');
          const [{ pid: secondPid }] = (await secondClient.query<{ pid: number }>(
            'SELECT pg_backend_pid() AS pid'
          )).rows;

          const secondInsert = secondClient.query(
            'INSERT INTO "PostGroup" ("postId", "groupId", position) VALUES ($1, $2, 1)',
            [secondPost.id, group.id]
          );

          await waitForBackendLockWait(prisma, secondPid);
          await firstClient.query('COMMIT');
          await secondInsert;
          await secondClient.query('COMMIT');

          const [stats] = await prisma.$queryRaw<Array<{
            memberCount: number;
            memberHash: string | null;
          }>>`
            SELECT "memberCount", "memberHash"
            FROM "Group"
            WHERE id = ${group.id}
          `;

          expect(stats).toEqual({
            memberCount: 2,
            memberHash: expectedMemberHash([firstPost.id, secondPost.id]),
          });
        } finally {
          await firstClient.query('ROLLBACK').catch(() => undefined);
          await secondClient.query('ROLLBACK').catch(() => undefined);
          firstClient.release();
          secondClient.release();
          await pool.end();
        }
      });
    });
  });

  describe('getGroupTypeCounts', () => {
    it('should return counts per source type', async () => {
      const prisma = getTestPrisma();

      // 2 PIXIV groups
      for (let i = 0; i < 2; i++) {
        const group = await createGroup(prisma, SourceType.PIXIV, `pixiv-${i}`);
        await createPostInGroup(prisma, group, 0);
        await createPostInGroup(prisma, group, 1);
      }

      // 1 TWITTER group
      const twitterGroup = await createGroup(prisma, SourceType.TWITTER, 'twitter-1');
      await createPostInGroup(prisma, twitterGroup, 0);
      await createPostInGroup(prisma, twitterGroup, 1);

      const counts = await getGroupTypeCounts(prisma);

      const pixivCount = counts.find(c => c.sourceType === SourceType.PIXIV);
      const twitterCount = counts.find(c => c.sourceType === SourceType.TWITTER);

      expect(pixivCount?.count).toBe(2);
      expect(twitterCount?.count).toBe(1);
    });

    it('should not count groups with less than 2 posts', async () => {
      const prisma = getTestPrisma();

      // Group with only 1 post
      const group = await createGroup(prisma, SourceType.PIXIV, 'single');
      await createPostInGroup(prisma, group, 0);

      const counts = await getGroupTypeCounts(prisma);

      expect(counts).toHaveLength(0);
    });
  });

  describe('group titles', () => {
    it('should return title for groups with titles', async () => {
      const prisma = getTestPrisma();

      const group = await createGroup(prisma, SourceType.TITLE, 'hash123', 'My Collection');
      await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      const result = await searchGroups({}, prisma);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groups[0].title).toBe('My Collection');
    });

    it('should return null title for groups without titles', async () => {
      const prisma = getTestPrisma();

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      const result = await searchGroups({}, prisma);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groups[0].title).toBeNull();
    });
  });

  describe('group creators', () => {
    it('should return artist tags as creators', async () => {
      const prisma = getTestPrisma();

      // Create an artist tag
      const artistTag = await createTag(prisma, 'famous_artist', TagCategory.ARTIST);

      // Create group with posts
      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post1 = await createPostInGroup(prisma, group, 0);
      const post2 = await createPostInGroup(prisma, group, 1);

      // Link posts to artist tag
      await prisma.postTag.create({ data: { postId: post1.id, tagId: artistTag.id } });
      await prisma.postTag.create({ data: { postId: post2.id, tagId: artistTag.id } });

      const result = await searchGroups({}, prisma);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].creators).toContain('famous_artist');
    });

    it('should filter out purely numerical creator names', async () => {
      const prisma = getTestPrisma();

      // Create artist tags - one valid, one numerical
      const validArtist = await createTag(prisma, 'real_artist', TagCategory.ARTIST);
      const numericArtist = await createTag(prisma, '12345678', TagCategory.ARTIST);

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post = await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      await prisma.postTag.create({ data: { postId: post.id, tagId: validArtist.id } });
      await prisma.postTag.create({ data: { postId: post.id, tagId: numericArtist.id } });

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].creators).toContain('real_artist');
      expect(result.groups[0].creators).not.toContain('12345678');
    });

    it('should filter out anonymous user IDs like "user abcd1234"', async () => {
      const prisma = getTestPrisma();

      const validArtist = await createTag(prisma, 'known_artist', TagCategory.ARTIST);
      const anonUser = await createTag(prisma, 'user abcd1234', TagCategory.ARTIST);
      const anonUser2 = await createTag(prisma, 'user_wxyz9999', TagCategory.ARTIST);

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post = await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      await prisma.postTag.create({ data: { postId: post.id, tagId: validArtist.id } });
      await prisma.postTag.create({ data: { postId: post.id, tagId: anonUser.id } });
      await prisma.postTag.create({ data: { postId: post.id, tagId: anonUser2.id } });

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].creators).toContain('known_artist');
      expect(result.groups[0].creators).not.toContain('user abcd1234');
      expect(result.groups[0].creators).not.toContain('user_wxyz9999');
    });

    it('should return empty creators array when no artist tags', async () => {
      const prisma = getTestPrisma();

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].creators).toEqual([]);
    });

    it('should limit creators to 3 per group', async () => {
      const prisma = getTestPrisma();

      // Create 5 artist tags
      const artists = await Promise.all([
        createTag(prisma, 'artist1', TagCategory.ARTIST),
        createTag(prisma, 'artist2', TagCategory.ARTIST),
        createTag(prisma, 'artist3', TagCategory.ARTIST),
        createTag(prisma, 'artist4', TagCategory.ARTIST),
        createTag(prisma, 'artist5', TagCategory.ARTIST),
      ]);

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post = await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      // Link all artists to the post
      for (const artist of artists) {
        await prisma.postTag.create({ data: { postId: post.id, tagId: artist.id } });
      }

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].creators).toHaveLength(3);
    });

    it('should derive creators from posts beyond the preview limit', async () => {
      const prisma = getTestPrisma();

      const lateArtist = await createTag(prisma, 'late_artist', TagCategory.ARTIST);
      const group = await createGroup(prisma, SourceType.PIXIV, 'large-creator-group');
      let lateArtistPostId = 0;

      for (let position = 0; position < 11; position++) {
        const post = await createPostInGroup(prisma, group, position);
        if (position === 10) {
          lateArtistPostId = post.id;
          await prisma.postTag.create({ data: { postId: post.id, tagId: lateArtist.id } });
        }
      }

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].posts).toHaveLength(10);
      expect(result.groups[0].posts.map((post) => post.postId)).not.toContain(lateArtistPostId);
      expect(result.groups[0].creators).toContain('late_artist');
    });

    it('should not include non-artist tags as creators', async () => {
      const prisma = getTestPrisma();

      const artistTag = await createTag(prisma, 'the_artist', TagCategory.ARTIST);
      const generalTag = await createTag(prisma, 'some_tag', TagCategory.GENERAL);
      const characterTag = await createTag(prisma, 'some_character', TagCategory.CHARACTER);

      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      const post = await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);

      await prisma.postTag.create({ data: { postId: post.id, tagId: artistTag.id } });
      await prisma.postTag.create({ data: { postId: post.id, tagId: generalTag.id } });
      await prisma.postTag.create({ data: { postId: post.id, tagId: characterTag.id } });

      const result = await searchGroups({}, prisma);

      expect(result.groups[0].creators).toEqual(['the_artist']);
    });
  });
});
