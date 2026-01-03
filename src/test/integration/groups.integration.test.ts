import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, createGroup, createPostInGroup, createTag } from './factories';
import { SourceType, TagCategory } from '@/generated/prisma/client';

let searchGroups: typeof import('@/lib/groups').searchGroups;
let getGroupTypeCounts: typeof import('@/lib/groups').getGroupTypeCounts;

describe('Groups Module (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/lib/groups');
    searchGroups = module.searchGroups;
    getGroupTypeCounts = module.getGroupTypeCounts;
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
