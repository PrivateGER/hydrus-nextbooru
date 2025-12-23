import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import { createPostWithTags, createPostsWithTag } from '../factories';
import { TagCategory } from '@/generated/prisma/client';

/**
 * Filter out meta tags from response to test regular tag behavior.
 * Meta tags have isMeta: true and negative IDs.
 */
function filterRegularTags<T extends { isMeta?: boolean }>(tags: T[]): T[] {
  return tags.filter(t => !t.isMeta);
}

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
    it('should return only meta tags when query is empty and no posts exist', async () => {
      const request = new NextRequest('http://localhost/api/tags/search?q=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // No regular tags without posts, but meta tags are always included
      expect(filterRegularTags(data.tags)).toEqual([]);
      // Meta tags should be present
      expect(data.tags.some((t: { isMeta?: boolean }) => t.isMeta)).toBe(true);
    });

    it('should return only meta tags when query parameter is missing', async () => {
      const request = new NextRequest('http://localhost/api/tags/search');
      const response = await GET(request);
      const data = await response.json();

      // No regular tags without posts, but meta tags are always included
      expect(filterRegularTags(data.tags)).toEqual([]);
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

    it('should return empty regular tags when selected tag does not exist', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes']);

      const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=nonexistent tag');
      const response = await GET(request);
      const data = await response.json();

      // Meta tags may still be returned, but regular tags should be empty
      expect(filterRegularTags(data.tags)).toEqual([]);
    });

    it('should return empty regular tags when no posts have all selected tags', async () => {
      const prisma = getTestPrisma();

      // No post has both tags
      await createPostWithTags(prisma, ['tag1']);
      await createPostWithTags(prisma, ['tag2']);

      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=tag1,tag2');
      const response = await GET(request);
      const data = await response.json();

      // Meta tags may still be returned, but regular tags should be empty
      expect(filterRegularTags(data.tags)).toEqual([]);
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

      // Filter out meta tags to check regular tags
      const regularTags = filterRegularTags(data.tags);
      expect(regularTags).toHaveLength(3);
    });

    it('should handle special characters in query', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['c++', 'c#', 'c language']);

      const request = new NextRequest('http://localhost/api/tags/search?q=c%2B%2B');
      const response = await GET(request);
      const data = await response.json();

      // Filter out meta tags to check regular tags
      const regularTags = filterRegularTags(data.tags);
      expect(regularTags).toHaveLength(1);
      expect(regularTags[0].name).toBe('c++');
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
        remainingCount: expect.any(Number),
      });
    });
  });

  describe('remainingCount calculation', () => {
    it('should return remainingCount for simple search (no selected tags)', async () => {
      const prisma = getTestPrisma();

      // Create 3 posts total, 2 with 'common tag', 1 with 'rare tag'
      await createPostWithTags(prisma, ['common tag', 'other1']);
      await createPostWithTags(prisma, ['common tag', 'other2']);
      await createPostWithTags(prisma, ['rare tag', 'other3']);

      // Initialize totalPostCount for simple search remainingCount calculation
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

      // remainingCount = totalPosts - count
      // For 'common tag': remainingCount = 3 - 2 = 1
      expect(commonTag.count).toBe(2);
      expect(commonTag.remainingCount).toBe(1);

      // For 'rare tag': remainingCount = 3 - 1 = 2
      expect(rareTag.count).toBe(1);
      expect(rareTag.remainingCount).toBe(2);
    });

    it('should return remainingCount for co-occurrence search (with selected tags)', async () => {
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
      // remainingCount = 3 - 2 = 1
      expect(commonHair.count).toBe(2);
      expect(commonHair.remainingCount).toBe(1);

      // 'rare hair' appears in 1 of the 3 filtered posts
      // remainingCount = 3 - 1 = 2
      expect(rareHair.count).toBe(1);
      expect(rareHair.remainingCount).toBe(2);
    });

    it('should return remainingCount for co-occurrence with negated tags', async () => {
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
      // remainingCount = 2 - 1 = 1 for each
      expect(data.tags).toHaveLength(2);
      for (const tag of data.tags) {
        expect(tag.count).toBe(1);
        expect(tag.remainingCount).toBe(1);
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
      // cooccur_a appears in 2/3 posts, so remainingCount = 1 (not omnipresent)
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

      // 'omnipresent' is in ALL 3 filtered posts, so remainingCount = 0 - should be filtered out
      expect(names).not.toContain('omnipresent');

      // 'partial' is in 1/3 posts, remainingCount = 2 - should be included
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

  describe('multiple exclusion tags remainingCount accuracy', () => {
    it('should calculate accurate remainingCount in browse mode (empty query) with existing exclusions', async () => {
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
      expect(resultTag.remainingCount).toBe(2); // 6 - 4 = 2

      // exclude_b appears only in post 8 (out of filtered 6)
      const excludeB = data.tags.find((t: { name: string }) => t.name === 'exclude_b');
      expect(excludeB).toBeDefined();
      expect(excludeB.count).toBe(1);
      expect(excludeB.remainingCount).toBe(5); // 6 - 1 = 5
    });

    it('should calculate accurate remainingCount with multiple combined exclusions', async () => {
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

      // result_tag appears in 6 of 10 posts, remainingCount = 4
      expect(resultTag1.count).toBe(6);
      expect(resultTag1.remainingCount).toBe(4);

      // Test 2: base_tag selected, exclude_a excluded
      // Filtered set: 10 - 4 = 6 posts (posts 1, 2, 3, 4, 5, 8)
      // result_tag in filtered set: posts 1, 2, 3, 8 = 4 posts
      const request2 = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag,-exclude_a');
      const response2 = await GET(request2);
      const data2 = await response2.json();
      const resultTag2 = data2.tags.find((t: { name: string }) => t.name === 'result_tag');

      expect(resultTag2.count).toBe(4);
      expect(resultTag2.remainingCount).toBe(2); // 6 - 4 = 2

      // Test 3: base_tag selected, exclude_a AND exclude_b excluded
      // Filtered set: posts that have base_tag but NOT exclude_a AND NOT exclude_b
      // = posts 1, 2, 3, 4, 5 = 5 posts
      // result_tag in filtered set: posts 1, 2, 3 = 3 posts
      const request3 = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag,-exclude_a,-exclude_b');
      const response3 = await GET(request3);
      const data3 = await response3.json();
      const resultTag3 = data3.tags.find((t: { name: string }) => t.name === 'result_tag');

      expect(resultTag3.count).toBe(3);
      expect(resultTag3.remainingCount).toBe(2); // 5 - 3 = 2
    });

    it('should show updated remainingCounts when progressively adding exclusions', async () => {
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

      // bikini appears in 3 of 8 posts, remainingCount = 5
      expect(bikini1.count).toBe(3);
      expect(bikini1.remainingCount).toBe(5);

      // one_piece appears in 3 of 8 posts, remainingCount = 5
      expect(onepiece1.count).toBe(3);
      expect(onepiece1.remainingCount).toBe(5);

      // Step 2: Add -bikini exclusion, check one_piece's remainingCount
      // Filtered set: 8 - 3 = 5 posts (1, 2, 3, 6, 7 - those without bikini)
      const request2 = new NextRequest('http://localhost/api/tags/search?q=&selected=swimsuit,-bikini');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      const onepiece2 = data2.tags.find((t: { name: string }) => t.name === 'one_piece');

      // one_piece appears in posts 6, 7 (post 8 was excluded because it has bikini)
      // So one_piece.count = 2, remainingCount = 5 - 2 = 3
      expect(onepiece2.count).toBe(2);
      expect(onepiece2.remainingCount).toBe(3);

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
      expect(pool3.remainingCount).toBe(1); // 3 - 2 = 1

      // beach appears in post 3 (out of filtered 3)
      expect(beach3.count).toBe(1);
      expect(beach3.remainingCount).toBe(2); // 3 - 1 = 2
    });
  });

  describe('wildcard patterns in selected tags', () => {
    describe('include wildcard validation', () => {
      it('should accept valid prefix wildcard pattern', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['character:saber', 'fate/stay night']);
        await createPostWithTags(prisma, ['character:rin', 'fate/stay night']);

        const request = new NextRequest('http://localhost/api/tags/search?q=fate&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tags).toHaveLength(1);
        expect(data.tags[0].name).toBe('fate/stay night');
      });

      it('should accept valid suffix wildcard pattern', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['blue_eyes', 'smile']);
        await createPostWithTags(prisma, ['red_eyes', 'smile']);
        await createPostWithTags(prisma, ['green_eyes', 'frown']); // has *_eyes but not smile
        await createPostWithTags(prisma, ['blonde_hair', 'other']);

        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=*_eyes');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Should find 'smile' which co-occurs with 2/3 *_eyes posts (not omnipresent)
        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('smile');
        // 'other' only appears in non-*_eyes post
        expect(names).not.toContain('other');
      });

      it('should reject standalone asterisk with 400', async () => {
        const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=*');
        const response = await GET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('too broad');
      });

      it('should reject pattern with insufficient characters with 400', async () => {
        const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=a*');
        const response = await GET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('at least 2');
      });
    });

    describe('exclude wildcard validation', () => {
      it('should accept valid negated wildcard pattern', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['base', 'character:saber', 'result_a']);
        await createPostWithTags(prisma, ['base', 'other_tag', 'result_b']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=base,-character:*');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Should only find result_b (from post without character:*)
        expect(data.tags).toHaveLength(1);
        expect(data.tags[0].name).toBe('result_b');
      });

      it('should reject negated standalone asterisk with 400', async () => {
        const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=-*');
        const response = await GET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Cannot exclude all');
      });

      it('should reject negated pattern with insufficient characters with 400', async () => {
        const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=-a*');
        const response = await GET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('at least 2');
      });
    });

    describe('include wildcard resolution', () => {
      it('should find co-occurring tags from posts matching wildcard', async () => {
        const prisma = getTestPrisma();
        // Create posts with different character: tags
        await createPostWithTags(prisma, ['character:saber', 'sword', 'blonde']);
        await createPostWithTags(prisma, ['character:rin', 'magic', 'dark_hair']);
        await createPostWithTags(prisma, ['character:archer', 'sword', 'dark_hair']);
        // Create post without character: tag
        await createPostWithTags(prisma, ['monster', 'scary']);

        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        // sword appears in 2 of 3 character:* posts
        expect(names).toContain('sword');
        expect(names).toContain('dark_hair');
        // scary only appears in non-character post
        expect(names).not.toContain('scary');
      });

      it('should handle SQL special characters in pattern (underscore)', async () => {
        const prisma = getTestPrisma();
        // Tags with underscore
        await createPostWithTags(prisma, ['blue_eyes', 'result_a']);
        await createPostWithTags(prisma, ['red_eyes', 'result_b']);
        // Tag without underscore that would match if _ wasn't escaped
        await createPostWithTags(prisma, ['blueeyes', 'result_c']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=*_eyes');
        const response = await GET(request);
        const data = await response.json();

        // Should only find results from posts with actual underscore tags
        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('result_a');
        expect(names).toContain('result_b');
        // blueeyes doesn't match *_eyes pattern
        expect(names).not.toContain('result_c');
      });

      it('should be case insensitive', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['Character:Saber', 'result_tag']);

        // Lowercase pattern should match mixed case tag
        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tags).toHaveLength(1);
        expect(data.tags[0].name).toBe('result_tag');
      });

      it('should return empty when wildcard matches no tags', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['some_tag', 'other_tag']);

        const request = new NextRequest('http://localhost/api/tags/search?q=test&selected=nonexistent:*');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tags).toEqual([]);
      });
    });

    describe('multiple wildcards (AND logic)', () => {
      it('should require posts to match ALL include wildcards', async () => {
        const prisma = getTestPrisma();
        // Post with both patterns
        await createPostWithTags(prisma, ['character:saber', 'series:fate', 'result_both']);
        // Post with only character:*
        await createPostWithTags(prisma, ['character:rin', 'other', 'result_char_only']);
        // Post with only series:*
        await createPostWithTags(prisma, ['series:naruto', 'ninja', 'result_series_only']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=character:*,series:*');
        const response = await GET(request);
        const data = await response.json();

        // Should only find result from post with BOTH patterns
        expect(data.tags).toHaveLength(1);
        expect(data.tags[0].name).toBe('result_both');
      });

      it('should combine include wildcard with regular include tag', async () => {
        const prisma = getTestPrisma();
        // Post with wildcard match AND exact tag
        await createPostWithTags(prisma, ['character:saber', 'blue eyes', 'result_match']);
        // Post with wildcard match but NOT exact tag
        await createPostWithTags(prisma, ['character:rin', 'red eyes', 'result_no_match']);
        // Post with exact tag but NOT wildcard match
        await createPostWithTags(prisma, ['blue eyes', 'other', 'result_no_wildcard']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=character:*,blue eyes');
        const response = await GET(request);
        const data = await response.json();

        // Should only find result from post with BOTH
        expect(data.tags).toHaveLength(1);
        expect(data.tags[0].name).toBe('result_match');
      });
    });

    describe('exclude wildcard filtering', () => {
      it('should exclude posts matching wildcard pattern', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['base', 'character:saber', 'result_excluded']);
        await createPostWithTags(prisma, ['base', 'character:rin', 'result_excluded_2']);
        await createPostWithTags(prisma, ['base', 'no_character', 'result_kept']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=base,-character:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('result_kept');
        expect(names).not.toContain('result_excluded');
        expect(names).not.toContain('result_excluded_2');
      });

      it('should handle multiple exclude wildcards', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['base', 'char:saber', 'result_char']);
        await createPostWithTags(prisma, ['base', 'artist:someone', 'result_artist']);
        await createPostWithTags(prisma, ['base', 'other_tag', 'result_kept']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=base,-char:*,-artist:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('result_kept');
        expect(names).not.toContain('result_char');
        expect(names).not.toContain('result_artist');
      });

      it('should combine regular exclude with wildcard exclude', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['base', 'exact_exclude', 'result_exact']);
        await createPostWithTags(prisma, ['base', 'char:saber', 'result_wildcard']);
        await createPostWithTags(prisma, ['base', 'safe_tag', 'result_kept']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=base,-exact_exclude,-char:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('result_kept');
        expect(names).not.toContain('result_exact');
        expect(names).not.toContain('result_wildcard');
      });

      it('should work with only negated wildcard in selection', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['character:saber', 'result_excluded']);
        await createPostWithTags(prisma, ['character:rin', 'result_excluded_2']);
        await createPostWithTags(prisma, ['no_character', 'result_kept']);

        const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=-character:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        expect(names).toContain('result_kept');
        expect(names).not.toContain('result_excluded');
        expect(names).not.toContain('result_excluded_2');
      });
    });

    describe('wildcard tags excluded from suggestions', () => {
      it('should not include matched wildcard tags in suggestions', async () => {
        const prisma = getTestPrisma();
        // character:saber and character:rin should be matched by wildcard but not in suggestions
        await createPostWithTags(prisma, ['character:saber', 'result_a']);
        await createPostWithTags(prisma, ['character:rin', 'result_b']);

        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        // The wildcard-matched tags should NOT appear in suggestions
        expect(names).not.toContain('character:saber');
        expect(names).not.toContain('character:rin');
        // But result tags should appear
        expect(names).toContain('result_a');
        expect(names).toContain('result_b');
      });
    });

    describe('remainingCount with wildcards', () => {
      it('should calculate correct remainingCount with include wildcard', async () => {
        const prisma = getTestPrisma();
        // 4 posts with character:* tags
        await createPostWithTags(prisma, ['character:saber', 'common_tag']);
        await createPostWithTags(prisma, ['character:rin', 'common_tag']);
        await createPostWithTags(prisma, ['character:archer', 'rare_tag']);
        await createPostWithTags(prisma, ['character:lancer', 'rare_tag']);

        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        const commonTag = data.tags.find((t: { name: string }) => t.name === 'common_tag');
        const rareTag = data.tags.find((t: { name: string }) => t.name === 'rare_tag');

        // common_tag appears in 2 of 4 filtered posts
        expect(commonTag.count).toBe(2);
        expect(commonTag.remainingCount).toBe(2); // 4 - 2 = 2

        // rare_tag appears in 2 of 4 filtered posts
        expect(rareTag.count).toBe(2);
        expect(rareTag.remainingCount).toBe(2); // 4 - 2 = 2
      });

      it('should calculate correct remainingCount with exclude wildcard', async () => {
        const prisma = getTestPrisma();
        // 5 posts with base tag
        await createPostWithTags(prisma, ['base', 'common_tag']); // kept
        await createPostWithTags(prisma, ['base', 'common_tag']); // kept
        await createPostWithTags(prisma, ['base', 'rare_tag']); // kept
        await createPostWithTags(prisma, ['base', 'char:a', 'common_tag']); // excluded
        await createPostWithTags(prisma, ['base', 'char:b', 'rare_tag']); // excluded

        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=base,-char:*');
        const response = await GET(request);
        const data = await response.json();

        // Filtered set: 3 posts (without char:*)
        const commonTag = data.tags.find((t: { name: string }) => t.name === 'common_tag');
        const rareTag = data.tags.find((t: { name: string }) => t.name === 'rare_tag');

        // common_tag appears in 2 of 3 filtered posts
        expect(commonTag.count).toBe(2);
        expect(commonTag.remainingCount).toBe(1); // 3 - 2 = 1

        // rare_tag appears in 1 of 3 filtered posts
        expect(rareTag.count).toBe(1);
        expect(rareTag.remainingCount).toBe(2); // 3 - 1 = 2
      });
    });

    describe('browse mode with wildcards', () => {
      it('should return co-occurring tags with empty query and include wildcard', async () => {
        const prisma = getTestPrisma();
        await createPostWithTags(prisma, ['character:saber', 'sword', 'blonde']);
        await createPostWithTags(prisma, ['character:rin', 'magic', 'dark_hair']);
        await createPostWithTags(prisma, ['monster', 'scary']); // no character:*

        // Empty query with wildcard in selected
        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tags.length).toBeGreaterThan(0);

        const names = data.tags.map((t: { name: string }) => t.name);
        // Tags from character:* posts should appear
        expect(names).toContain('sword');
        expect(names).toContain('magic');
        // Tags only from non-character posts should not appear
        expect(names).not.toContain('scary');
      });

      it('should filter omnipresent tags in browse mode with wildcard', async () => {
        const prisma = getTestPrisma();
        // 'omnipresent' appears in ALL character:* posts
        await createPostWithTags(prisma, ['character:saber', 'omnipresent', 'partial']);
        await createPostWithTags(prisma, ['character:rin', 'omnipresent', 'other']);
        await createPostWithTags(prisma, ['character:archer', 'omnipresent']);

        // Empty query - browse mode should filter omnipresent tags
        const request = new NextRequest('http://localhost/api/tags/search?q=&selected=character:*');
        const response = await GET(request);
        const data = await response.json();

        const names = data.tags.map((t: { name: string }) => t.name);
        // 'omnipresent' is in ALL 3 filtered posts, remainingCount = 0 - should be filtered
        expect(names).not.toContain('omnipresent');
        // 'partial' is in 1/3 posts - should be included
        expect(names).toContain('partial');
      });
    });
  });

  describe('blacklist filtering', () => {
    it('should exclude blacklisted tags from simple search results', async () => {
      const prisma = getTestPrisma();
      // site:pixiv is in the default blacklist
      await createPostWithTags(prisma, ['site:pixiv', 'normal_tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=site');
      const response = await GET(request);
      const data = await response.json();

      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).not.toContain('site:pixiv');
    });

    it('should exclude blacklisted tags matching wildcard pattern from results', async () => {
      const prisma = getTestPrisma();
      // hydl-import-time:* is in the default blacklist
      await createPostWithTags(prisma, ['hydl-import-time:2024-01-01', 'normal_tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=hydl');
      const response = await GET(request);
      const data = await response.json();

      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).not.toContain('hydl-import-time:2024-01-01');
    });

    it('should filter blacklisted tags from selected tags parameter', async () => {
      const prisma = getTestPrisma();
      // Create posts where site:pixiv is used as a filter
      await createPostWithTags(prisma, ['site:pixiv', 'co_occurring_tag']);
      await createPostWithTags(prisma, ['other_source', 'different_tag']);

      // Try to use blacklisted tag as selected filter
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      // Since site:pixiv is blacklisted and stripped, this should fall back to popular tags
      // (no selected tags after filtering = return popular tags)
      expect(response.status).toBe(200);
      // Both co_occurring_tag and different_tag should be returned (popular tags mode)
      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).toContain('co_occurring_tag');
      expect(names).toContain('different_tag');
    });

    it('should filter blacklisted tags from excluded tags in selected parameter', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['base_tag', 'site:pixiv', 'result_a']);
      await createPostWithTags(prisma, ['base_tag', 'other', 'result_b']);

      // Try to exclude blacklisted tag - should be ignored
      const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=base_tag,-site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      // Both result_a and result_b should be returned since -site:pixiv is stripped
      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).toContain('result_a');
      expect(names).toContain('result_b');
    });

    it('should exclude blacklisted tags from co-occurrence results', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['normal_selected', 'site:pixiv', 'visible_tag']);
      await createPostWithTags(prisma, ['normal_selected', 'hydl-import-time:2024', 'visible_tag']);
      // Add a third post without visible_tag so it's not omnipresent (remainingCount > 0)
      await createPostWithTags(prisma, ['normal_selected', 'other_tag']);

      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=normal_selected');
      const response = await GET(request);
      const data = await response.json();

      const names = data.tags.map((t: { name: string }) => t.name);
      // Blacklisted tags should not appear in co-occurrence results
      expect(names).not.toContain('site:pixiv');
      expect(names).not.toContain('hydl-import-time:2024');
      // Normal tags should appear (visible_tag appears in 2/3 posts, not omnipresent)
      expect(names).toContain('visible_tag');
    });

    it('should handle mixed blacklisted and normal tags in selected parameter', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['normal_tag', 'result_tag']);
      await createPostWithTags(prisma, ['normal_tag', 'other_result']);

      // Mix of blacklisted and normal - blacklisted should be stripped
      const request = new NextRequest('http://localhost/api/tags/search?q=result&selected=normal_tag,site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      // Should work as if only normal_tag was selected
      const names = data.tags.map((t: { name: string }) => t.name);
      expect(names).toContain('result_tag');
    });

    it('should return popular tags when all selected tags are blacklisted', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['popular_tag1']);
      await createPostWithTags(prisma, ['popular_tag2']);

      // All blacklisted selected tags - should fall back to popular tags
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=site:pixiv,hydl-import-time:2024');
      const response = await GET(request);
      const data = await response.json();

      // Should return popular tags since all selected were stripped
      expect(response.status).toBe(200);
      expect(data.tags.length).toBeGreaterThan(0);
    });
  });

  describe('selected meta tags', () => {
    it('should filter by meta tag as first/only selected tag', async () => {
      const prisma = getTestPrisma();
      // Create video posts with specific tags
      await createPostWithTags(prisma, ['action', 'anime'], { mimeType: 'video/mp4' });
      await createPostWithTags(prisma, ['action', 'cartoon'], { mimeType: 'video/webm' });
      // Create image posts with different tags
      await createPostWithTags(prisma, ['still', 'anime'], { mimeType: 'image/png' });

      // Select only the "video" meta tag - use query to avoid omnipresent filtering
      const request = new NextRequest('http://localhost/api/tags/search?q=a&selected=video');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const regularTags = filterRegularTags(data.tags);

      // Should only find tags from video posts that contain 'a'
      const tagNames = regularTags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('action'); // appears in 2 video posts
      expect(tagNames).toContain('anime'); // appears in 1 video post
      expect(tagNames).toContain('cartoon'); // appears in 1 video post
      expect(tagNames).not.toContain('still'); // only in image post
    });

    it('should return correct co-occurrence counts with meta tag selected', async () => {
      const prisma = getTestPrisma();
      // Create 2 highres posts with different tags
      await createPostWithTags(prisma, ['nature', 'mountains'], { width: 1920, height: 1080 });
      await createPostWithTags(prisma, ['nature', 'ocean'], { width: 2560, height: 1440 });
      // Create 1 lowres post
      await createPostWithTags(prisma, ['nature', 'city'], { width: 400, height: 300 });

      // Select the "highres" meta tag with a search query
      const request = new NextRequest('http://localhost/api/tags/search?q=n&selected=highres');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const regularTags = filterRegularTags(data.tags);

      // "nature" appears in both highres posts - count should be 2
      const natureTag = regularTags.find((t: { name: string }) => t.name === 'nature');
      expect(natureTag).toBeDefined();
      expect(natureTag.count).toBe(2);

      // "mountains" and "ocean" should each have count 1
      const mountainsTag = regularTags.find((t: { name: string }) => t.name === 'mountains');
      const oceanTag = regularTags.find((t: { name: string }) => t.name === 'ocean');
      expect(mountainsTag?.count).toBe(1);
      expect(oceanTag?.count).toBe(1);

      // "city" only appears in lowres post, so shouldn't be in results
      const cityTag = regularTags.find((t: { name: string }) => t.name === 'city');
      expect(cityTag).toBeUndefined();
    });

    it('should combine meta tag with regular tag filters', async () => {
      const prisma = getTestPrisma();
      // Create posts with various combinations
      await createPostWithTags(prisma, ['anime', 'action', 'fight'], { mimeType: 'video/mp4' });
      await createPostWithTags(prisma, ['anime', 'comedy'], { mimeType: 'image/png' });
      await createPostWithTags(prisma, ['cartoon', 'action'], { mimeType: 'video/mp4' });

      // Select both "video" meta tag and "anime" regular tag with a search query
      const request = new NextRequest('http://localhost/api/tags/search?q=a&selected=video,anime');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const regularTags = filterRegularTags(data.tags);

      // Only tags from the video+anime post that contain 'a' should appear
      const tagNames = regularTags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('action'); // appears in anime+video post
      expect(tagNames).not.toContain('comedy'); // anime but not video
      expect(tagNames).not.toContain('cartoon'); // video but not anime
    });

    it('should handle negated meta tags', async () => {
      const prisma = getTestPrisma();
      // Create video and image posts
      await createPostWithTags(prisma, ['video_only_tag'], { mimeType: 'video/mp4' });
      await createPostWithTags(prisma, ['image_only_tag'], { mimeType: 'image/png' });
      await createPostWithTags(prisma, ['shared_tag'], { mimeType: 'video/mp4' });
      await createPostWithTags(prisma, ['shared_tag'], { mimeType: 'image/jpeg' });

      // Select -video to exclude video posts
      const request = new NextRequest('http://localhost/api/tags/search?q=&selected=-video');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const regularTags = filterRegularTags(data.tags);

      // Should only find tags from non-video posts
      const tagNames = regularTags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('image_only_tag');
      expect(tagNames).not.toContain('video_only_tag');
    });

    it('should filter by orientation meta tag (portrait)', async () => {
      const prisma = getTestPrisma();
      // Create portrait (height > width) and landscape posts
      await createPostWithTags(prisma, ['portrait_art', 'art'], { width: 800, height: 1200 });
      await createPostWithTags(prisma, ['landscape_art', 'art'], { width: 1200, height: 800 });

      // Select "portrait" meta tag with search query
      const request = new NextRequest('http://localhost/api/tags/search?q=art&selected=portrait');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const regularTags = filterRegularTags(data.tags);

      const tagNames = regularTags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('portrait_art');
      expect(tagNames).not.toContain('landscape_art');
    });
  });
});
