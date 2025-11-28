import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import { createPostWithTags, createPostsWithTag } from '../factories';
import { TagCategory } from '@/generated/prisma/client';

let GET: typeof import('@/app/api/tags/route').GET;

describe('GET /api/tags (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/tags/route');
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

  describe('basic listing', () => {
    it('should return empty list when no tags exist', async () => {
      const request = new NextRequest('http://localhost/api/tags');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual([]);
      expect(data.pagination.totalCount).toBe(0);
    });

    it('should list all tags with counts', async () => {
      const prisma = getTestPrisma();
      await createPostsWithTag(prisma, 'popular', 5);
      await createPostsWithTag(prisma, 'rare', 1);

      const request = new NextRequest('http://localhost/api/tags');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      expect(data.tags[0].name).toBe('popular');
      expect(data.tags[0].count).toBe(5);
    });
  });

  describe('filtering', () => {
    it('should filter by query', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blue hair', 'red dress']);

      const request = new NextRequest('http://localhost/api/tags?q=blue');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      expect(data.tags.every((t: { name: string }) => t.name.includes('blue'))).toBe(true);
    });

    it('should filter by category', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, [
        { name: 'artist1', category: TagCategory.ARTIST },
        { name: 'general1', category: TagCategory.GENERAL },
      ]);

      const request = new NextRequest('http://localhost/api/tags?category=ARTIST');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].category).toBe('ARTIST');
    });
  });

  describe('sorting', () => {
    it('should sort by count descending by default', async () => {
      const prisma = getTestPrisma();
      await createPostsWithTag(prisma, 'popular', 10);
      await createPostsWithTag(prisma, 'medium', 5);
      await createPostsWithTag(prisma, 'rare', 1);

      const request = new NextRequest('http://localhost/api/tags');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags[0].name).toBe('popular');
      expect(data.tags[1].name).toBe('medium');
      expect(data.tags[2].name).toBe('rare');
    });

    it('should sort by name ascending', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['zebra', 'apple', 'banana']);

      const request = new NextRequest('http://localhost/api/tags?sort=name');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags[0].name).toBe('apple');
      expect(data.tags[1].name).toBe('banana');
      expect(data.tags[2].name).toBe('zebra');
    });
  });

  describe('pagination', () => {
    it('should paginate results', async () => {
      const prisma = getTestPrisma();
      for (let i = 0; i < 5; i++) {
        await createPostWithTags(prisma, [`tag${i}`]);
      }

      const request = new NextRequest('http://localhost/api/tags?limit=2&page=1');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.totalCount).toBe(5);
      expect(data.pagination.totalPages).toBe(3);
    });

    it('should return correct page', async () => {
      const prisma = getTestPrisma();
      for (let i = 0; i < 5; i++) {
        await createPostsWithTag(prisma, `tag${i}`, 5 - i); // Different counts for ordering
      }

      const page1 = await GET(new NextRequest('http://localhost/api/tags?limit=2&page=1'));
      const page2 = await GET(new NextRequest('http://localhost/api/tags?limit=2&page=2'));

      const data1 = await page1.json();
      const data2 = await page2.json();

      expect(data1.tags.map((t: { name: string }) => t.name)).not.toEqual(
        data2.tags.map((t: { name: string }) => t.name)
      );
    });

    it('should cap limit at 200', async () => {
      const request = new NextRequest('http://localhost/api/tags?limit=500');
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(200);
    });
  });
});
