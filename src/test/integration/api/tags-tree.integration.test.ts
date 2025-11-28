import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags, createPostsWithTag, createTag } from '../factories';
import { TagCategory } from '@/generated/prisma/client';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';

let GET: typeof import('@/app/api/tags/tree/route').GET;

describe('GET /api/tags/tree (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/tags/tree/route');
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

  describe('no selected tags', () => {
    it('should return top tags by category when no selection', async () => {
      const prisma = getTestPrisma();

      // Create posts with various tags
      await createPostWithTags(prisma, [
        { name: 'alice', category: TagCategory.ARTIST },
        { name: 'blue eyes', category: TagCategory.GENERAL },
      ]);
      await createPostWithTags(prisma, [
        { name: 'alice', category: TagCategory.ARTIST },
        { name: 'red hair', category: TagCategory.GENERAL },
      ]);

      const request = new NextRequest('http://localhost/api/tags/tree');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags.length).toBeGreaterThan(0);
      expect(data.postCount).toBe(2);
      expect(data.selectedTags).toEqual([]);
    });

    it('should filter by category', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, [
        { name: 'alice', category: TagCategory.ARTIST },
        { name: 'blue eyes', category: TagCategory.GENERAL },
      ]);

      const request = new NextRequest('http://localhost/api/tags/tree?category=ARTIST');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags.every((t: { category: string }) => t.category === 'ARTIST')).toBe(true);
    });

    it('should filter by search query', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, [
        { name: 'blue eyes', category: TagCategory.GENERAL },
        { name: 'blue hair', category: TagCategory.GENERAL },
        { name: 'red eyes', category: TagCategory.GENERAL },
      ]);

      const request = new NextRequest('http://localhost/api/tags/tree?q=blue');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags.length).toBe(2);
      expect(data.tags.every((t: { name: string }) => t.name.includes('blue'))).toBe(true);
    });
  });

  describe('with selected tags', () => {
    it('should return co-occurring tags for selected tag', async () => {
      const prisma = getTestPrisma();

      // Post 1: blue eyes, blonde hair
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']);
      // Post 2: blue eyes, red hair
      await createPostWithTags(prisma, ['blue eyes', 'red hair']);
      // Post 3: green eyes, blonde hair (no blue eyes)
      await createPostWithTags(prisma, ['green eyes', 'blonde hair']);

      const request = new NextRequest('http://localhost/api/tags/tree?selected=blue eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.postCount).toBe(2); // 2 posts have blue eyes
      expect(data.selectedTags).toEqual(['blue eyes']);

      // Should include blonde hair and red hair (co-occur with blue eyes)
      // Should NOT include blue eyes itself or green eyes
      const tagNames = data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('blonde hair');
      expect(tagNames).toContain('red hair');
      expect(tagNames).not.toContain('blue eyes');
      expect(tagNames).not.toContain('green eyes');
    });

    it('should narrow down with multiple selected tags (AND logic)', async () => {
      const prisma = getTestPrisma();

      // Post 1: tag1, tag2, tag3
      await createPostWithTags(prisma, ['tag1', 'tag2', 'tag3']);
      // Post 2: tag1, tag2, tag4
      await createPostWithTags(prisma, ['tag1', 'tag2', 'tag4']);
      // Post 3: tag1, tag5
      await createPostWithTags(prisma, ['tag1', 'tag5']);

      const request = new NextRequest('http://localhost/api/tags/tree?selected=tag1,tag2');
      const response = await GET(request);
      const data = await response.json();

      expect(data.postCount).toBe(2); // Only 2 posts have both tag1 AND tag2
      expect(data.selectedTags).toEqual(['tag1', 'tag2']);

      const tagNames = data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('tag3');
      expect(tagNames).toContain('tag4');
      expect(tagNames).not.toContain('tag5'); // tag5 doesn't co-occur with both
    });

    it('should return empty when no posts match all selected tags', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, ['tag1']);
      await createPostWithTags(prisma, ['tag2']);

      const request = new NextRequest('http://localhost/api/tags/tree?selected=tag1,tag2');
      const response = await GET(request);
      const data = await response.json();

      expect(data.postCount).toBe(0);
      expect(data.tags).toEqual([]);
    });

    it('should return empty when selected tag does not exist', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, ['existing tag']);

      const request = new NextRequest('http://localhost/api/tags/tree?selected=nonexistent');
      const response = await GET(request);
      const data = await response.json();

      expect(data.postCount).toBe(0);
      expect(data.tags).toEqual([]);
    });

    it('should show tag counts relative to selected posts', async () => {
      const prisma = getTestPrisma();

      // Create posts where "common" appears with "filter" in 2 posts
      await createPostWithTags(prisma, ['filter', 'common']);
      await createPostWithTags(prisma, ['filter', 'common']);
      await createPostWithTags(prisma, ['filter', 'rare']);
      // This post has common but not filter
      await createPostWithTags(prisma, ['common', 'other']);

      const request = new NextRequest('http://localhost/api/tags/tree?selected=filter');
      const response = await GET(request);
      const data = await response.json();

      const commonTag = data.tags.find((t: { name: string }) => t.name === 'common');
      const rareTag = data.tags.find((t: { name: string }) => t.name === 'rare');

      expect(commonTag?.count).toBe(2); // 2 posts with filter+common
      expect(rareTag?.count).toBe(1); // 1 post with filter+rare
    });
  });

  describe('blacklist filtering', () => {
    it('should exclude blacklisted tags from results', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, [
        'normal tag',
        'site:pixiv', // Blacklisted
        'hydl-import-time:2024', // Blacklisted by wildcard
      ]);

      const request = new NextRequest('http://localhost/api/tags/tree');
      const response = await GET(request);
      const data = await response.json();

      const tagNames = data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('normal tag');
      expect(tagNames).not.toContain('site:pixiv');
      expect(tagNames).not.toContain('hydl-import-time:2024');
    });
  });

  describe('response format', () => {
    it('should return correct structure', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, [
        { name: 'test artist', category: TagCategory.ARTIST },
      ]);

      const request = new NextRequest('http://localhost/api/tags/tree');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('postCount');
      expect(data).toHaveProperty('selectedTags');

      if (data.tags.length > 0) {
        expect(data.tags[0]).toHaveProperty('id');
        expect(data.tags[0]).toHaveProperty('name');
        expect(data.tags[0]).toHaveProperty('category');
        expect(data.tags[0]).toHaveProperty('count');
      }
    });

    it('should respect limit parameter', async () => {
      const prisma = getTestPrisma();

      // Create many tags
      for (let i = 0; i < 20; i++) {
        await createPostWithTags(prisma, [`tag${i}`]);
      }

      const request = new NextRequest('http://localhost/api/tags/tree?q=tag&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tags.length).toBeLessThanOrEqual(5);
    });
  });
});
