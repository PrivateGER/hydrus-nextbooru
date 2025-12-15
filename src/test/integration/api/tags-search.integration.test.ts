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
        excludeCount: expect.any(Number),
      });
    });
  });

  describe('excludeCount calculation', () => {
    it('should return excludeCount for simple search (no selected tags)', async () => {
      const prisma = getTestPrisma();

      // Create 3 posts total, 2 with 'common tag', 1 with 'rare tag'
      await createPostWithTags(prisma, ['common tag', 'other1']);
      await createPostWithTags(prisma, ['common tag', 'other2']);
      await createPostWithTags(prisma, ['rare tag', 'other3']);

      // Initialize totalPostCount for simple search excludeCount calculation
      await prisma.settings.upsert({
        where: { key: 'stats.totalPostCount' },
        update: { value: '3' },
        create: { key: 'stats.totalPostCount', value: '3' },
      });

      const request = new NextRequest('http://localhost/api/tags/search?q=tag');
      const response = await GET(request);
      const data = await response.json();

      // Find the tags in results
      const commonTag = data.tags.find((t: { name: string }) => t.name === 'common tag');
      const rareTag = data.tags.find((t: { name: string }) => t.name === 'rare tag');

      // excludeCount = totalPosts - count
      // For 'common tag': excludeCount = 3 - 2 = 1
      expect(commonTag.count).toBe(2);
      expect(commonTag.excludeCount).toBe(1);

      // For 'rare tag': excludeCount = 3 - 1 = 2
      expect(rareTag.count).toBe(1);
      expect(rareTag.excludeCount).toBe(2);
    });

    it('should return excludeCount for co-occurrence search (with selected tags)', async () => {
      const prisma = getTestPrisma();

      // Create posts with different tag combinations
      // Post 1: blue eyes, common hair, smile (filtered set member)
      // Post 2: blue eyes, common hair, frown (filtered set member)
      // Post 3: blue eyes, rare hair, neutral (filtered set member)
      // Post 4: green eyes, common hair (not in filtered set - no blue eyes)
      await createPostWithTags(prisma, ['blue eyes', 'common hair', 'smile']);
      await createPostWithTags(prisma, ['blue eyes', 'common hair', 'frown']);
      await createPostWithTags(prisma, ['blue eyes', 'rare hair', 'neutral']);
      await createPostWithTags(prisma, ['green eyes', 'common hair']);

      // Search with 'blue eyes' selected - filtered set has 3 posts
      const request = new NextRequest('http://localhost/api/tags/search?q=hair&selected=blue eyes');
      const response = await GET(request);
      const data = await response.json();

      const commonHair = data.tags.find((t: { name: string }) => t.name === 'common hair');
      const rareHair = data.tags.find((t: { name: string }) => t.name === 'rare hair');

      // 'common hair' appears in 2 of the 3 filtered posts
      // excludeCount = 3 - 2 = 1
      expect(commonHair.count).toBe(2);
      expect(commonHair.excludeCount).toBe(1);

      // 'rare hair' appears in 1 of the 3 filtered posts
      // excludeCount = 3 - 1 = 2
      expect(rareHair.count).toBe(1);
      expect(rareHair.excludeCount).toBe(2);
    });

    it('should return excludeCount for co-occurrence with negated tags', async () => {
      const prisma = getTestPrisma();

      // Post 1: tag1, result_a (in filtered set)
      // Post 2: tag1, result_b (in filtered set)
      // Post 3: tag1, excluded_tag, result_c (NOT in filtered set due to exclusion)
      await createPostWithTags(prisma, ['tag1', 'result_a']);
      await createPostWithTags(prisma, ['tag1', 'result_b']);
      await createPostWithTags(prisma, ['tag1', 'excluded_tag', 'result_c']);

      // Require tag1, exclude excluded_tag - filtered set has 2 posts
      const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=tag1,-excluded_tag');
      const response = await GET(request);
      const data = await response.json();

      // Both result_a and result_b appear in 1 post each
      // excludeCount = 2 - 1 = 1 for each
      expect(data.tags).toHaveLength(2);
      for (const tag of data.tags) {
        expect(tag.count).toBe(1);
        expect(tag.excludeCount).toBe(1);
      }
    });
  });

  describe('tag negation in selected tags', () => {
    it('should exclude posts with negated selected tag', async () => {
      const prisma = getTestPrisma();

      // Create posts with different combinations
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair', 'smile']);
      await createPostWithTags(prisma, ['blue eyes', 'red hair', 'frown']);
      await createPostWithTags(prisma, ['green eyes', 'blonde hair', 'neutral']);

      // Search with blue eyes selected and blonde hair excluded
      const request = new NextRequest('http://localhost/api/tags/search?q=hair&selected=blue eyes,-blonde hair');
      const response = await GET(request);
      const data = await response.json();

      // Should only find tags from the post with blue eyes but NOT blonde hair
      expect(data.tags).toHaveLength(1);
      expect(data.tags[0].name).toBe('red hair');
    });

    it('should handle only negated tags in selection', async () => {
      const prisma = getTestPrisma();

      await createPostWithTags(prisma, ['excluded tag', 'result1']);
      await createPostWithTags(prisma, ['other', 'result2']);
      await createPostWithTags(prisma, ['other', 'result3']);

      // Only exclude, no required tags
      const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=-excluded tag');
      const response = await GET(request);
      const data = await response.json();

      // Should find tags from posts that don't have 'excluded tag'
      expect(data.tags).toHaveLength(2);
      const names = data.tags.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(['result2', 'result3']);
    });

    it('should exclude negated tags from suggestions', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']);

      // Search for 'blonde' with blonde hair as negated - should not appear
      const request = new NextRequest('http://localhost/api/tags/search?q=blonde&selected=-blonde hair');
      const response = await GET(request);
      const data = await response.json();

      // The negated tag itself should not appear in results
      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).not.toContain('blonde hair');
    });

    it('should handle mixed included and excluded tags', async () => {
      const prisma = getTestPrisma();

      // Post 1: has tag1, tag2, result_a
      await createPostWithTags(prisma, ['tag1', 'tag2', 'result_a']);
      // Post 2: has tag1, result_b (no tag2)
      await createPostWithTags(prisma, ['tag1', 'result_b']);
      // Post 3: has tag1, tag2, tag3, result_c
      await createPostWithTags(prisma, ['tag1', 'tag2', 'tag3', 'result_c']);

      // Require tag1, exclude tag3
      const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=tag1,-tag3');
      const response = await GET(request);
      const data = await response.json();

      // Should find result_a and result_b (posts with tag1 but not tag3)
      expect(data.tags).toHaveLength(2);
      const names = data.tags.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(['result_a', 'result_b']);
    });
  });

  describe('empty query with selected tags (browse mode)', () => {
    it('should return co-occurring tags when q is empty but selected tags provided', async () => {
      const prisma = getTestPrisma();

      // Create posts with shared base tag and different co-occurring tags
      await createPostWithTags(prisma, ['base tag', 'cooccur_a', 'cooccur_b']);
      await createPostWithTags(prisma, ['base tag', 'cooccur_a', 'cooccur_c']);
      await createPostWithTags(prisma, ['base tag', 'cooccur_d']);

      // Empty query with selected tag - should return co-occurring tags
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=base tag');
      const response = await GET(request);
      const data = await response.json();

      // Should return co-occurring tags (not empty)
      expect(data.tags.length).toBeGreaterThan(0);
      const names = data.tags.map((t: { name: string }) => t.name);
      // cooccur_a appears in 2/3 posts, so excludeCount = 1 (not omnipresent)
      expect(names).toContain('cooccur_a');
    });

    it('should filter out omnipresent tags when browsing without query', async () => {
      const prisma = getTestPrisma();

      // Create posts where 'omnipresent' appears in ALL posts
      // and 'partial' appears in only SOME posts
      await createPostWithTags(prisma, ['filter tag', 'omnipresent', 'partial']);
      await createPostWithTags(prisma, ['filter tag', 'omnipresent', 'other']);
      await createPostWithTags(prisma, ['filter tag', 'omnipresent']);

      // Empty query - browsing mode should filter out omnipresent tags
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=filter tag');
      const response = await GET(request);
      const data = await response.json();

      const names = data.tags.map((t: { name: string }) => t.name);

      // 'omnipresent' is in ALL 3 filtered posts, so excludeCount = 0 - should be filtered out
      expect(names).not.toContain('omnipresent');

      // 'partial' is in 1/3 posts, excludeCount = 2 - should be included
      expect(names).toContain('partial');
    });

    it('should still return omnipresent tags when there is a search query', async () => {
      const prisma = getTestPrisma();

      // Same setup as above
      await createPostWithTags(prisma, ['search tag', 'omnipresent', 'partial']);
      await createPostWithTags(prisma, ['search tag', 'omnipresent', 'other']);
      await createPostWithTags(prisma, ['search tag', 'omnipresent']);

      // WITH query - should include omnipresent tags if they match
      const request = new NextRequest('http://localhost/api/tags/search?q=omni&selected=search tag');
      const response = await GET(request);
      const data = await response.json();

      const names = data.tags.map((t: { name: string }) => t.name);

      // With a search query, omnipresent tags matching the query SHOULD be returned
      expect(names).toContain('omnipresent');
    });
  });

  describe('multiple exclusion tags excludeCount accuracy', () => {
    it('should calculate accurate excludeCount in browse mode (empty query) with existing exclusions', async () => {
      const prisma = getTestPrisma();

      // Setup: same scenario but test empty query (browse mode)
      // Posts with base_tag only: 5 (posts 1-5)
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 1
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 2
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 3
      await createPostWithTags(prisma, ['base_tag']); // post 4
      await createPostWithTags(prisma, ['base_tag']); // post 5

      // Posts with base_tag + exclude_a only (2 more): posts 6-7
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'result_tag']); // post 6
      await createPostWithTags(prisma, ['base_tag', 'exclude_a']); // post 7

      // Posts with base_tag + exclude_b only (1 more): post 8
      await createPostWithTags(prisma, ['base_tag', 'exclude_b', 'result_tag']); // post 8

      // Posts with base_tag + exclude_a + exclude_b (2): posts 9-10
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'exclude_b', 'result_tag']); // post 9
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'exclude_b']); // post 10

      // Test empty query (browse mode) with one exclusion already applied
      // Filtered set: 10 - 4 = 6 posts (posts 1, 2, 3, 4, 5, 8)
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=base_tag,-exclude_a');
      const response = await GET(request);
      const data = await response.json();

      // result_tag appears in posts 1, 2, 3, 8 = 4 posts out of 6 filtered
      const resultTag = data.tags.find((t: { name: string }) => t.name === 'result_tag');
      expect(resultTag).toBeDefined();
      expect(resultTag.count).toBe(4);
      expect(resultTag.excludeCount).toBe(2); // 6 - 4 = 2

      // exclude_b appears only in post 8 (out of filtered 6)
      const excludeB = data.tags.find((t: { name: string }) => t.name === 'exclude_b');
      expect(excludeB).toBeDefined();
      expect(excludeB.count).toBe(1);
      expect(excludeB.excludeCount).toBe(5); // 6 - 1 = 5
    });

    it('should calculate accurate excludeCount with multiple combined exclusions', async () => {
      const prisma = getTestPrisma();

      // Set up a controlled scenario:
      // - 10 posts with base_tag
      // - 4 of those also have exclude_a
      // - 3 of those also have exclude_b
      // - 2 have both exclude_a AND exclude_b
      // - result_tag appears on various posts

      // Posts with base_tag only: 5 (posts 1-5)
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 1
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 2
      await createPostWithTags(prisma, ['base_tag', 'result_tag']); // post 3
      await createPostWithTags(prisma, ['base_tag']); // post 4
      await createPostWithTags(prisma, ['base_tag']); // post 5

      // Posts with base_tag + exclude_a only (2 more): posts 6-7
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'result_tag']); // post 6
      await createPostWithTags(prisma, ['base_tag', 'exclude_a']); // post 7

      // Posts with base_tag + exclude_b only (1 more): post 8
      await createPostWithTags(prisma, ['base_tag', 'exclude_b', 'result_tag']); // post 8

      // Posts with base_tag + exclude_a + exclude_b (2): posts 9-10
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'exclude_b', 'result_tag']); // post 9
      await createPostWithTags(prisma, ['base_tag', 'exclude_a', 'exclude_b']); // post 10

      // Total: 10 posts with base_tag
      // - 4 posts with exclude_a (posts 6, 7, 9, 10)
      // - 3 posts with exclude_b (posts 8, 9, 10)
      // - 2 posts with both (posts 9, 10)
      // - result_tag appears in: posts 1, 2, 3, 6, 8, 9 = 6 posts

      // Test 1: Just base_tag selected (10 posts filtered)
      const request1 = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag');
      const response1 = await GET(request1);
      const data1 = await response1.json();
      const resultTag1 = data1.tags.find((t: { name: string }) => t.name === 'result_tag');

      // result_tag appears in 6 of 10 posts, excludeCount = 4
      expect(resultTag1.count).toBe(6);
      expect(resultTag1.excludeCount).toBe(4);

      // Test 2: base_tag selected, exclude_a excluded
      // Filtered set: 10 - 4 = 6 posts (posts 1, 2, 3, 4, 5, 8)
      // result_tag in filtered set: posts 1, 2, 3, 8 = 4 posts
      const request2 = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag,-exclude_a');
      const response2 = await GET(request2);
      const data2 = await response2.json();
      const resultTag2 = data2.tags.find((t: { name: string }) => t.name === 'result_tag');

      expect(resultTag2.count).toBe(4);
      expect(resultTag2.excludeCount).toBe(2); // 6 - 4 = 2

      // Test 3: base_tag selected, exclude_a AND exclude_b excluded
      // Filtered set: posts that have base_tag but NOT exclude_a AND NOT exclude_b
      // = posts 1, 2, 3, 4, 5 = 5 posts
      // result_tag in filtered set: posts 1, 2, 3 = 3 posts
      const request3 = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag,-exclude_a,-exclude_b');
      const response3 = await GET(request3);
      const data3 = await response3.json();
      const resultTag3 = data3.tags.find((t: { name: string }) => t.name === 'result_tag');

      expect(resultTag3.count).toBe(3);
      expect(resultTag3.excludeCount).toBe(2); // 5 - 3 = 2
    });

    it('should show updated excludeCounts when progressively adding exclusions', async () => {
      const prisma = getTestPrisma();

      // Scenario: User searches for "swimsuit" and progressively excludes tags
      // This mimics the exact flow: search -> exclude one tag -> type "-" -> see updated suggestions

      // Create posts:
      // Post 1-3: swimsuit only
      await createPostWithTags(prisma, ['swimsuit', 'pool']);
      await createPostWithTags(prisma, ['swimsuit', 'pool']);
      await createPostWithTags(prisma, ['swimsuit', 'beach']);

      // Post 4-5: swimsuit + bikini
      await createPostWithTags(prisma, ['swimsuit', 'bikini', 'pool']);
      await createPostWithTags(prisma, ['swimsuit', 'bikini', 'beach']);

      // Post 6-7: swimsuit + one_piece
      await createPostWithTags(prisma, ['swimsuit', 'one_piece', 'pool']);
      await createPostWithTags(prisma, ['swimsuit', 'one_piece', 'beach']);

      // Post 8: swimsuit + bikini + one_piece (has both)
      await createPostWithTags(prisma, ['swimsuit', 'bikini', 'one_piece', 'pool']);

      // Total: 8 posts with swimsuit
      // - bikini: 3 posts (4, 5, 8)
      // - one_piece: 3 posts (6, 7, 8)
      // - pool: 5 posts (1, 4, 6, 8 - wait, let me recalculate)

      // Recalculating:
      // Post 1: swimsuit, pool
      // Post 2: swimsuit, pool
      // Post 3: swimsuit, beach
      // Post 4: swimsuit, bikini, pool
      // Post 5: swimsuit, bikini, beach
      // Post 6: swimsuit, one_piece, pool
      // Post 7: swimsuit, one_piece, beach
      // Post 8: swimsuit, bikini, one_piece, pool

      // pool: posts 1, 2, 4, 6, 8 = 5 posts
      // beach: posts 3, 5, 7 = 3 posts
      // bikini: posts 4, 5, 8 = 3 posts
      // one_piece: posts 6, 7, 8 = 3 posts

      // Step 1: Search with just "swimsuit" selected
      const request1 = new NextRequest('http://localhost/api/tags/search?q=&selected=swimsuit');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const bikini1 = data1.tags.find((t: { name: string }) => t.name === 'bikini');
      const onepiece1 = data1.tags.find((t: { name: string }) => t.name === 'one_piece');

      // bikini appears in 3 of 8 posts, excludeCount = 5
      expect(bikini1.count).toBe(3);
      expect(bikini1.excludeCount).toBe(5);

      // one_piece appears in 3 of 8 posts, excludeCount = 5
      expect(onepiece1.count).toBe(3);
      expect(onepiece1.excludeCount).toBe(5);

      // Step 2: Add -bikini exclusion, check one_piece's excludeCount
      // Filtered set: 8 - 3 = 5 posts (1, 2, 3, 6, 7 - those without bikini)
      const request2 = new NextRequest('http://localhost/api/tags/search?q=&selected=swimsuit,-bikini');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      const onepiece2 = data2.tags.find((t: { name: string }) => t.name === 'one_piece');

      // one_piece appears in posts 6, 7 (post 8 was excluded because it has bikini)
      // So one_piece.count = 2, excludeCount = 5 - 2 = 3
      expect(onepiece2.count).toBe(2);
      expect(onepiece2.excludeCount).toBe(3);

      // Step 3: Add -one_piece exclusion as well
      // Filtered set: posts without bikini AND without one_piece
      // = posts 1, 2, 3 = 3 posts
      const request3 = new NextRequest('http://localhost/api/tags/search?q=&selected=swimsuit,-bikini,-one_piece');
      const response3 = await GET(request3);
      const data3 = await response3.json();

      const pool3 = data3.tags.find((t: { name: string }) => t.name === 'pool');
      const beach3 = data3.tags.find((t: { name: string }) => t.name === 'beach');

      // pool appears in posts 1, 2 (out of filtered 3)
      expect(pool3.count).toBe(2);
      expect(pool3.excludeCount).toBe(1); // 3 - 2 = 1

      // beach appears in post 3 (out of filtered 3)
      expect(beach3.count).toBe(1);
      expect(beach3.excludeCount).toBe(2); // 3 - 1 = 2
    });
  });
});
