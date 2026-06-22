import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TagCategory } from '@/generated/prisma/client';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from './factories';
import { invalidateAllCaches } from '@/lib/cache';

let searchPosts: typeof import('@/lib/search').searchPosts;

describe('searchPosts related tags (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    searchPosts = (await import('@/lib/search')).searchPosts;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
  });

  it('is not computed unless requested', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, ['blue archive', 'solo']);

    const result = await searchPosts(['blue archive'], 1);

    expect(result.relatedTags).toBeUndefined();
  });

  it('returns co-occurring tags ordered by frequency, excluding the searched tags', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, ['blue archive', 'solo', 'smile']);
    await createPostWithTags(prisma, ['blue archive', 'solo']);
    await createPostWithTags(prisma, ['unrelated tag']);

    const result = await searchPosts(['blue archive'], 1, { includeRelatedTags: true });

    expect(result.relatedTags).toEqual([
      expect.objectContaining({ name: 'solo', count: 2 }),
      expect.objectContaining({ name: 'smile', count: 1 }),
    ]);
    expect(result.relatedTags!.map((t) => t.name)).not.toContain('blue archive');
  });

  it('includes the tag category for display grouping', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, [
      'blue archive',
      { name: 'some artist', category: TagCategory.ARTIST },
    ]);

    const result = await searchPosts(['blue archive'], 1, { includeRelatedTags: true });

    expect(result.relatedTags).toEqual([
      expect.objectContaining({ name: 'some artist', category: 'ARTIST', count: 1 }),
    ]);
  });

  it('excludes searched tags case-insensitively and ignores negation prefixes', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, ['Blue Archive', 'smile']);

    const result = await searchPosts(['BLUE ARCHIVE', '-solo'], 1, { includeRelatedTags: true });

    const names = result.relatedTags!.map((t) => t.name);
    expect(names).toContain('smile');
    expect(names.map((n) => n.toLowerCase())).not.toContain('blue archive');
  });

  it('returns an empty list when the search matches nothing', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, ['blue archive']);

    const result = await searchPosts(['no such tag'], 1, { includeRelatedTags: true });

    expect(result.posts).toHaveLength(0);
    expect(result.relatedTags).toEqual([]);
  });

  it('only counts tags from the current page of results', async () => {
    const prisma = getTestPrisma();
    // Three matching posts, page size of two. Posts are ordered newest-first,
    // so the two most recently created posts form page one.
    await createPostWithTags(prisma, ['blue archive', 'off-page tag']);
    await createPostWithTags(prisma, ['blue archive', 'on-page tag']);
    await createPostWithTags(prisma, ['blue archive', 'on-page tag']);

    const result = await searchPosts(['blue archive'], 1, {
      includeRelatedTags: true,
      limit: 2,
    });

    expect(result.posts).toHaveLength(2);
    expect(result.relatedTags).toEqual([
      expect.objectContaining({ name: 'on-page tag', count: 2 }),
    ]);
  });

  it('breaks count ties deterministically by name', async () => {
    const prisma = getTestPrisma();
    await createPostWithTags(prisma, ['blue archive', 'zzz tag', 'aaa tag']);

    const result = await searchPosts(['blue archive'], 1, { includeRelatedTags: true });

    expect(result.relatedTags!.map((t) => t.name)).toEqual(['aaa tag', 'zzz tag']);
  });
});
