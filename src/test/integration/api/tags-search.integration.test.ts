import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import { createPostWithTags, createPostsWithTag } from '../factories';
import { TagCategory } from '@/generated/prisma/client';

// Dynamic import to ensure prisma injection works
let GET: typeof import('@/app/api/tags/search/route').GET;

describe('GET /api/tags/search (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Dynamic import after Prisma is set up
    const module = await import('@/app/api/tags/search/route');
    GET = module.GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
    clearPatternCache();
  });

  describe('empty query handling', () => {
    it('should return empty array when query is empty', async () => {
      const request = new NextRequest('http://localhost/api/tags/search?q=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual([]);
    });

    it('should return empty array when query parameter is missing', async () => {
      const request = new NextRequest('http://localhost/api/tags/search');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
    });
  });

  describe('simple search (no selected tags)', () => {
    it('should search tags by name containing query', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blue hair', 'red dress']);

      const request = new NextRequest('http://localhost/api/tags/search?q=blue');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toHaveLength(2);
      expect(data.tags.map((t: { name: string }) => t.name).sort()).toEqual(['blue eyes', 'blue hair']);
    });

    it('should be case insensitive', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['Blue Eyes', 'BLUE HAIR']);

      const request = new NextRequest('http://localhost/api/tags/search?q=blue');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const prisma = getTestPrisma();
      // Create 10 tags
      await createPostWithTags(prisma, [
        'test1', 'test2', 'test3', 'test4', 'test5',
        'test6', 'test7', 'test8', 'test9', 'test10',
      ]);

      const request = new NextRequest('http://localhost/api/tags/search?q=test&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(5);
    });

    it('should cap limit at 50', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['test tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=test&limit=100');
      const response = await GET(request);

      // Should not error, just cap at 50
      expect(response.status).toBe(200);
    });

    it('should return tags with correct categories', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, [
        { name: 'john doe', category: TagCategory.ARTIST },
        { name: 'john smith', category: TagCategory.CHARACTER },
      ]);

      const request = new NextRequest('http://localhost/api/tags/search?q=john');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      const categories = data.tags.map((t: { category: string }) => t.category).sort();
      expect(categories).toEqual(['ARTIST', 'CHARACTER']);
    });

    it('should order by post count descending', async () => {
      const prisma = getTestPrisma();

      // Create tags with different post counts
      await createPostsWithTag(prisma, 'popular tag', 10);
      await createPostsWithTag(prisma, 'less popular', 3);
      await createPostsWithTag(prisma, 'rare tag', 1);

      const request = new NextRequest('http://localhost/api/tags/search?q=tag');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags[0].name).toBe('popular tag');
      expect(data.tags[0].count).toBe(10);
    });
  });

  describe('co-occurrence filtering (with selected tags)', () => {
    it('should find tags that co-occur with selected tag', async () => {
      const prisma = getTestPrisma();

      // Create posts with different tag combinations
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']); // Has blue eyes
      await createPostWithTags(prisma, ['blue eyes', 'red hair']);    // Has blue eyes
      await createPostWithTags(prisma, ['green eyes', 'blonde hair']); // No blue eyes

      const request = new NextRequest('http://localhost/api/tags/search?q=hair&selected=blue eyes');
      const response = await GET(request);
      const data = await response.json();

      // Should only find hair tags that co-occur with blue eyes
      expect(data.tags).toHaveLength(2);
      const names = data.tags.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(['blonde hair', 'red hair']);
    });

    it('should handle multiple selected tags (AND logic)', async () => {
      const prisma = getTestPrisma();

      // Only post 1 has both blue eyes AND blonde hair
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair', 'smile']);
      await createPostWithTags(prisma, ['blue eyes', 'red hair', 'frown']);
      await createPostWithTags(prisma, ['green eyes', 'blonde hair', 'neutral']);

      // Query for 'smile' with both tags selected - should find it
      const request = new NextRequest('http://localhost/api/tags/search?q=smile&selected=blue eyes,blonde hair');
      const response = await GET(request);
      const data = await response.json();

      // Should only find 'smile' from the one post with both selected tags
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('smile');
    });

    it('should exclude already selected tags from results', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']);

      const request = new NextRequest('http://localhost/api/tags/search?q=blue&selected=blue eyes');
      const response = await GET(request);
      const data = await response.json();

      // 'blue eyes' should not appear since it's already selected
      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).not.toContain('blue eyes');
    });

    it('should return empty when selected tag does not exist', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes']);

      const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=nonexistent tag');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
    });

    it('should return empty when no posts have all selected tags', async () => {
      const prisma = getTestPrisma();

      // No post has both tags
      await createPostWithTags(prisma, ['tag1']);
      await createPostWithTags(prisma, ['tag2']);

      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=tag1,tag2');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toEqual([]);
    });
  });

  describe('selected tags parsing', () => {
    it('should trim whitespace from selected tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'other tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=other&selected=  blue eyes  ');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('other tag');
    });

    it('should handle case-insensitive selected tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'other tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=other&selected=BLUE EYES');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
    });

    it('should filter out empty selected tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['test tag']);

      // All commas, no actual tags - should fall back to simple search
      const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=,,,');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle single character query', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['a', 'ab', 'abc']);

      const request = new NextRequest('http://localhost/api/tags/search?q=a');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(3);
    });

    it('should handle special characters in query', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['c++', 'c#', 'c language']);

      const request = new NextRequest('http://localhost/api/tags/search?q=c%2B%2B');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('c++');
    });

    it('should return correct response structure', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, [{ name: 'test tag', category: TagCategory.ARTIST }]);

      const request = new NextRequest('http://localhost/api/tags/search?q=test');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('tags');
      expect(Array.isArray(data.tags)).toBe(true);
      expect(data.tags[0]).toMatchObject({
        id: expect.any(Number),
        name: 'test tag',
        category: 'ARTIST',
        count: 1,
      });
    });
  });
});
