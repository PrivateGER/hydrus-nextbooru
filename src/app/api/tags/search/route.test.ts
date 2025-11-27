import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { TagCategory } from '@/generated/prisma/client';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Import after mocking
import { GET } from './route';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock NextRequest with search params
 */
function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/tags/search');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

/**
 * Create a mock tag with post count
 */
function createMockTag(
  id: number,
  name: string,
  category: TagCategory = TagCategory.GENERAL,
  postCount: number = 1
) {
  return {
    id,
    name,
    category,
    _count: { posts: postCount },
  };
}

/**
 * Create a mock tag with posts array (for co-occurrence queries)
 */
function createMockTagWithPosts(
  id: number,
  name: string,
  category: TagCategory = TagCategory.GENERAL,
  postIds: number[] = []
) {
  return {
    id,
    name,
    category,
    posts: postIds.map((postId) => ({ postId })),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/tags/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
  });

  describe('empty query handling', () => {
    it('should return empty array when query is empty', async () => {
      const request = createRequest({ q: '' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
      expect(prismaMock.tag.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when query parameter is missing', async () => {
      const request = createRequest({});

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
      expect(prismaMock.tag.findMany).not.toHaveBeenCalled();
    });
  });

  describe('simple search (no selected tags)', () => {
    it('should search tags by name containing query', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'blue eyes', TagCategory.GENERAL, 100),
        createMockTag(2, 'blue hair', TagCategory.GENERAL, 50),
      ] as never);

      const request = createRequest({ q: 'blue' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      expect(data.tags[0]).toEqual({
        id: 1,
        name: 'blue eyes',
        category: 'GENERAL',
        count: 100,
      });
      expect(data.tags[1]).toEqual({
        id: 2,
        name: 'blue hair',
        category: 'GENERAL',
        count: 50,
      });

      // Verify query structure
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: 'blue',
              mode: 'insensitive',
            },
          },
          take: 20, // default limit
        })
      );
    });

    it('should respect limit parameter', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'tag1', TagCategory.GENERAL, 10),
      ] as never);

      const request = createRequest({ q: 'tag', limit: '5' });

      await GET(request);

      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should cap limit at 50', async () => {
      prismaMock.tag.findMany.mockResolvedValue([] as never);

      const request = createRequest({ q: 'tag', limit: '100' });

      await GET(request);

      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should return tags with different categories', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'john doe', TagCategory.ARTIST, 50),
        createMockTag(2, 'john smith', TagCategory.CHARACTER, 30),
      ] as never);

      const request = createRequest({ q: 'john' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags[0].category).toBe('ARTIST');
      expect(data.tags[1].category).toBe('CHARACTER');
    });

    it('should order by post count descending', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'popular tag', TagCategory.GENERAL, 1000),
        createMockTag(2, 'less popular', TagCategory.GENERAL, 100),
      ] as never);

      const request = createRequest({ q: 'tag' });

      await GET(request);

      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ posts: { _count: 'desc' } }],
        })
      );
    });
  });

  describe('co-occurrence filtering (with selected tags)', () => {
    it('should find tags that co-occur with selected tag', async () => {
      // First query: find posts with selected tags
      prismaMock.post.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ] as never);

      // Second query: find tags on those posts
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'related tag', TagCategory.GENERAL, [1, 2, 3]),
        createMockTagWithPosts(2, 'another tag', TagCategory.GENERAL, [1, 2]),
      ] as never);

      const request = createRequest({ q: 'tag', selected: 'blue eyes' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      expect(data.tags[0].count).toBe(3); // sorted by count desc
      expect(data.tags[1].count).toBe(2);

      // Verify posts query includes selected tag filter
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                tags: {
                  some: {
                    tag: {
                      name: {
                        equals: 'blue eyes',
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
            ],
          },
        })
      );
    });

    it('should handle multiple selected tags (AND logic)', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'rare combo tag', TagCategory.GENERAL, [1]),
      ] as never);

      const request = createRequest({
        q: 'tag',
        selected: 'blue eyes, blonde hair, smile',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);

      // Verify AND logic for multiple selected tags
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blue eyes', mode: 'insensitive' } } } },
              }),
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blonde hair', mode: 'insensitive' } } } },
              }),
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'smile', mode: 'insensitive' } } } },
              }),
            ],
          },
        })
      );
    });

    it('should exclude already selected tags from results', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'other tag', TagCategory.GENERAL, [1]),
      ] as never);

      const request = createRequest({ q: 'eyes', selected: 'blue eyes' });

      await GET(request);

      // Verify exclusion of selected tags
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            NOT: {
              name: {
                in: ['blue eyes'],
                mode: 'insensitive',
              },
            },
          }),
        })
      );
    });

    it('should return empty when no posts have all selected tags', async () => {
      prismaMock.post.findMany.mockResolvedValue([] as never);

      const request = createRequest({
        q: 'tag',
        selected: 'nonexistent tag combo',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
      // Should not query for tags if no posts match
      expect(prismaMock.tag.findMany).not.toHaveBeenCalled();
    });

    it('should filter out tags with zero count', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'has posts', TagCategory.GENERAL, [1]),
        createMockTagWithPosts(2, 'no posts', TagCategory.GENERAL, []),
      ] as never);

      const request = createRequest({ q: 'tag', selected: 'filter' });

      const response = await GET(request);
      const data = await response.json();

      // Should only include tags with posts
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('has posts');
    });

    it('should respect limit when returning co-occurrence results', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'tag1', TagCategory.GENERAL, [1, 2]),
        createMockTagWithPosts(2, 'tag2', TagCategory.GENERAL, [1, 2]),
        createMockTagWithPosts(3, 'tag3', TagCategory.GENERAL, [1]),
      ] as never);

      const request = createRequest({ q: 'tag', selected: 'base', limit: '2' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
    });

    it('should sort co-occurrence results by count descending', async () => {
      prismaMock.post.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ] as never);
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTagWithPosts(1, 'rare', TagCategory.GENERAL, [1]),
        createMockTagWithPosts(2, 'common', TagCategory.GENERAL, [1, 2, 3]),
        createMockTagWithPosts(3, 'medium', TagCategory.GENERAL, [1, 2]),
      ] as never);

      const request = createRequest({ q: 'tag', selected: 'base' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags[0].name).toBe('common');
      expect(data.tags[0].count).toBe(3);
      expect(data.tags[1].name).toBe('medium');
      expect(data.tags[1].count).toBe(2);
      expect(data.tags[2].name).toBe('rare');
      expect(data.tags[2].count).toBe(1);
    });
  });

  describe('selected tags parsing', () => {
    it('should trim whitespace from selected tags', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([] as never);

      const request = createRequest({
        q: 'test',
        selected: '  blue eyes  ,  blonde hair  ',
      });

      await GET(request);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blue eyes', mode: 'insensitive' } } } },
              }),
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blonde hair', mode: 'insensitive' } } } },
              }),
            ],
          },
        })
      );
    });

    it('should lowercase selected tags for case-insensitive matching', async () => {
      prismaMock.post.findMany.mockResolvedValue([{ id: 1 }] as never);
      prismaMock.tag.findMany.mockResolvedValue([] as never);

      const request = createRequest({
        q: 'test',
        selected: 'Blue Eyes, BLONDE HAIR',
      });

      await GET(request);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blue eyes', mode: 'insensitive' } } } },
              }),
              expect.objectContaining({
                tags: { some: { tag: { name: { equals: 'blonde hair', mode: 'insensitive' } } } },
              }),
            ],
          },
        })
      );
    });

    it('should filter out empty selected tags', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'test', TagCategory.GENERAL, 10),
      ] as never);

      const request = createRequest({
        q: 'test',
        selected: ',,,',
      });

      const response = await GET(request);
      const data = await response.json();

      // Should fall back to simple search when all selected tags are empty
      expect(data.tags).toHaveLength(1);
      expect(prismaMock.post.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle single character query', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'a', TagCategory.GENERAL, 5),
      ] as never);

      const request = createRequest({ q: 'a' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
    });

    it('should handle special characters in query', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(1, 'c++', TagCategory.GENERAL, 5),
      ] as never);

      const request = createRequest({ q: 'c++' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: 'c++',
              mode: 'insensitive',
            },
          },
        })
      );
    });

    it('should handle invalid limit gracefully', async () => {
      prismaMock.tag.findMany.mockResolvedValue([] as never);

      const request = createRequest({ q: 'test', limit: 'invalid' });

      await GET(request);

      // NaN from parseInt should result in default behavior
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: expect.any(Number),
        })
      );
    });

    it('should return correct response structure', async () => {
      prismaMock.tag.findMany.mockResolvedValue([
        createMockTag(42, 'test tag', TagCategory.ARTIST, 123),
      ] as never);

      const request = createRequest({ q: 'test' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('tags');
      expect(Array.isArray(data.tags)).toBe(true);
      expect(data.tags[0]).toEqual({
        id: 42,
        name: 'test tag',
        category: 'ARTIST',
        count: 123,
      });
    });
  });
});
