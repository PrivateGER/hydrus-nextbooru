import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags, createPost } from '../factories';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';

let GET: typeof import('@/app/api/posts/search/route').GET;

describe('GET /api/posts/search (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/posts/search/route');
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

  describe('empty/invalid queries', () => {
    it('should return empty when no tags specified', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['some tag']);

      const request = new NextRequest('http://localhost/api/posts/search');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should return empty when tags param is empty', async () => {
      const request = new NextRequest('http://localhost/api/posts/search?tags=');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
    });
  });

  describe('single tag search', () => {
    it('should find posts with matching tag', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes']);
      await createPostWithTags(prisma, ['red eyes']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=blue eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should be case insensitive', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['Blue Eyes']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=BLUE EYES');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
    });
  });

  describe('multiple tag search (AND logic)', () => {
    it('should find posts with ALL specified tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']); // Has both
      await createPostWithTags(prisma, ['blue eyes', 'red hair']);    // Has only blue eyes
      await createPostWithTags(prisma, ['green eyes', 'blonde hair']); // Has only blonde hair

      const request = new NextRequest('http://localhost/api/posts/search?tags=blue eyes,blonde hair');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should return empty when no post has all tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['tag1']);
      await createPostWithTags(prisma, ['tag2']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=tag1,tag2');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('should paginate results', async () => {
      const prisma = getTestPrisma();
      for (let i = 0; i < 5; i++) {
        await createPostWithTags(prisma, ['common tag']);
      }

      const request = new NextRequest('http://localhost/api/posts/search?tags=common tag&limit=2&page=1');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(5);
      expect(data.totalPages).toBe(3);
    });

    it('should return different posts on different pages', async () => {
      const prisma = getTestPrisma();
      for (let i = 0; i < 4; i++) {
        await createPostWithTags(prisma, ['common tag']);
      }

      const page1 = await GET(new NextRequest('http://localhost/api/posts/search?tags=common tag&limit=2&page=1'));
      const page2 = await GET(new NextRequest('http://localhost/api/posts/search?tags=common tag&limit=2&page=2'));

      const data1 = await page1.json();
      const data2 = await page2.json();

      const ids1 = data1.posts.map((p: { id: number }) => p.id);
      const ids2 = data2.posts.map((p: { id: number }) => p.id);

      expect(ids1).not.toEqual(ids2);
    });

    it('should cap limit at 100', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['tag']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=tag&limit=200');
      const response = await GET(request);

      // Should not error
      expect(response.status).toBe(200);
    });
  });

  describe('response format', () => {
    it('should return correct post fields', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['test'], {
        width: 1920,
        height: 1080,
        mimeType: 'image/png',
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      });

      const request = new NextRequest('http://localhost/api/posts/search?tags=test');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts[0]).toMatchObject({
        id: expect.any(Number),
        hash: expect.any(String),
        width: 1920,
        height: 1080,
        mimeType: 'image/png',
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      });
    });
  });
});
