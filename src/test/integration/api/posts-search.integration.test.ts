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

  describe('tag negation', () => {
    it('should exclude posts with negated tag', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue eyes', 'blonde hair']);
      await createPostWithTags(prisma, ['blue eyes', 'red hair']);
      await createPostWithTags(prisma, ['green eyes', 'blonde hair']);

      // Search for blue eyes but exclude blonde hair
      const request = new NextRequest('http://localhost/api/posts/search?tags=blue eyes,-blonde hair');
      const response = await GET(request);
      const data = await response.json();

      // Should only find the post with blue eyes and red hair
      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should work with only negated tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['tag1', 'common']);
      await createPostWithTags(prisma, ['tag2', 'common']);
      await createPostWithTags(prisma, ['tag3', 'excluded']);

      // Exclude posts with 'excluded' tag, find posts with 'common'
      const request = new NextRequest('http://localhost/api/posts/search?tags=common,-excluded');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    it('should handle multiple negated tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['base', 'exclude1']);
      await createPostWithTags(prisma, ['base', 'exclude2']);
      await createPostWithTags(prisma, ['base', 'keep']);

      // Exclude multiple tags
      const request = new NextRequest('http://localhost/api/posts/search?tags=base,-exclude1,-exclude2');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should be case insensitive for negated tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['test', 'Excluded Tag']);
      await createPostWithTags(prisma, ['test', 'other']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=test,-excluded tag');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
    });

    it('should return empty when all posts are excluded', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['common', 'exclude']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=common,-exclude');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should handle hyphenated tags that are not negations', async () => {
      const prisma = getTestPrisma();
      // The tag itself has a hyphen but is not a negation (just "-" alone)
      await createPostWithTags(prisma, ['blue-eyes', 'other']);

      // Search for hyphenated tag (not negation)
      const request = new NextRequest('http://localhost/api/posts/search?tags=blue-eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
    });
  });

  describe('wildcard search', () => {
    it('should find posts with tags matching prefix wildcard', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['character:saber']);
      await createPostWithTags(prisma, ['character:rin']);
      await createPostWithTags(prisma, ['artist:someone']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=character:*');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
      expect(data.resolvedWildcards).toBeDefined();
      expect(data.resolvedWildcards).toHaveLength(1);
      expect(data.resolvedWildcards[0].pattern).toBe('character:*');
      expect(data.resolvedWildcards[0].tagNames).toContain('character:saber');
      expect(data.resolvedWildcards[0].tagNames).toContain('character:rin');
    });

    it('should find posts with tags matching suffix wildcard', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue_eyes']);
      await createPostWithTags(prisma, ['red_eyes']);
      await createPostWithTags(prisma, ['blonde_hair']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=*_eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    it('should NOT match tags that contain pattern in middle (trailing wildcard)', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['shorts']);        // should match short*
      await createPostWithTags(prisma, ['short_hair']);    // should match short*
      await createPostWithTags(prisma, ['black shorts']);  // should NOT match short*

      const request = new NextRequest('http://localhost/api/posts/search?tags=short*');
      const response = await GET(request);
      const data = await response.json();

      // Only 'shorts' and 'short_hair' start with 'short', not 'black shorts'
      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    it('should combine wildcard with exact tag (AND logic)', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['character:saber', 'fate/stay night']);
      await createPostWithTags(prisma, ['character:rin', 'fate/stay night']);
      await createPostWithTags(prisma, ['character:saber', 'other series']);

      // Find posts with any character tag AND fate/stay night
      const request = new NextRequest('http://localhost/api/posts/search?tags=character:*,fate/stay night');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
    });

    it('should support negated wildcard patterns', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['blue_eyes', 'common']);
      await createPostWithTags(prisma, ['red_eyes', 'common']);
      await createPostWithTags(prisma, ['blonde_hair', 'common']);

      // Find posts with 'common' but exclude all *_eyes tags
      const request = new NextRequest('http://localhost/api/posts/search?tags=common,-*_eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should return empty when wildcard matches no tags', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['some_tag']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=nonexistent:*');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
      expect(data.resolvedWildcards).toBeDefined();
      expect(data.resolvedWildcards[0].tagIds).toHaveLength(0);
    });

    it('should reject too-broad wildcard patterns', async () => {
      const request = new NextRequest('http://localhost/api/posts/search?tags=*');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should reject wildcard with insufficient characters', async () => {
      const request = new NextRequest('http://localhost/api/posts/search?tags=a*');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 2');
    });

    it('should handle multiple wildcards', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['character:saber', 'blue_eyes']);
      await createPostWithTags(prisma, ['character:rin', 'red_eyes']);
      await createPostWithTags(prisma, ['character:archer', 'no_eyes_tag']);

      // Find posts with any character AND any *_eyes tag
      const request = new NextRequest('http://localhost/api/posts/search?tags=character:*,*_eyes');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(2);
      expect(data.resolvedWildcards).toHaveLength(2);
    });

    it('should be case insensitive for wildcards', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['Character:Saber']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=character:*');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toHaveLength(1);
    });
  });

  describe('blacklist filtering', () => {
    it('should filter out blacklisted tags from search (exact match)', async () => {
      const prisma = getTestPrisma();
      // site:pixiv is in the default blacklist
      await createPostWithTags(prisma, ['site:pixiv', 'other_tag']);

      // Searching for a blacklisted tag should return empty results
      const request = new NextRequest('http://localhost/api/posts/search?tags=site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should filter out blacklisted tags from search (wildcard pattern)', async () => {
      const prisma = getTestPrisma();
      // hydl-import-time:* is in the default blacklist
      await createPostWithTags(prisma, ['hydl-import-time:2024-01-01', 'other_tag']);

      // Searching for a blacklisted tag should return empty results
      const request = new NextRequest('http://localhost/api/posts/search?tags=hydl-import-time:2024-01-01');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should filter out blacklisted tags from negated search', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['site:pixiv', 'normal_tag']);
      await createPostWithTags(prisma, ['normal_tag', 'other']);

      // Trying to exclude a blacklisted tag should be ignored (tag is stripped)
      // This means both posts match just 'normal_tag'
      const request = new NextRequest('http://localhost/api/posts/search?tags=normal_tag,-site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      // Both posts should be returned since -site:pixiv is stripped
      expect(data.posts).toHaveLength(2);
    });

    it('should allow searching with non-blacklisted tags when blacklisted tags are also provided', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['normal_tag', 'another_tag']);
      await createPostWithTags(prisma, ['normal_tag']);

      // Mix of blacklisted and normal tags - blacklisted are stripped
      const request = new NextRequest('http://localhost/api/posts/search?tags=normal_tag,site:pixiv');
      const response = await GET(request);
      const data = await response.json();

      // Should find posts with normal_tag (site:pixiv is stripped)
      expect(data.posts).toHaveLength(2);
    });

    it('should return empty when all provided tags are blacklisted', async () => {
      const prisma = getTestPrisma();
      await createPostWithTags(prisma, ['site:pixiv', 'hydl-import-time:2024']);

      // All blacklisted tags - should return empty
      const request = new NextRequest('http://localhost/api/posts/search?tags=site:pixiv,hydl-import-time:2024');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });
  });

  describe('post hiding (HIDE_POSTS_WITH_TAGS)', () => {
    const originalEnv = process.env.HIDE_POSTS_WITH_TAGS;

    afterEach(() => {
      // Restore original env var
      if (originalEnv === undefined) {
        delete process.env.HIDE_POSTS_WITH_TAGS;
      } else {
        process.env.HIDE_POSTS_WITH_TAGS = originalEnv;
      }
      clearPatternCache();
    });

    it('should hide posts containing tags from HIDE_POSTS_WITH_TAGS (exact match)', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'nsfw';
      clearPatternCache();

      await createPostWithTags(prisma, ['nsfw', 'some_tag']);
      await createPostWithTags(prisma, ['some_tag', 'safe']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=some_tag');
      const response = await GET(request);
      const data = await response.json();

      // Only the safe post should be returned
      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should hide posts containing tags from HIDE_POSTS_WITH_TAGS (wildcard pattern)', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'rating:*';
      clearPatternCache();

      await createPostWithTags(prisma, ['rating:explicit', 'character:saber']);
      await createPostWithTags(prisma, ['rating:safe', 'character:saber']);
      await createPostWithTags(prisma, ['character:saber', 'no_rating']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=character:saber');
      const response = await GET(request);
      const data = await response.json();

      // Only the post without any rating:* tag should be returned
      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should hide posts with multiple hiding patterns', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'nsfw,explicit,rating:explicit';
      clearPatternCache();

      await createPostWithTags(prisma, ['nsfw', 'tag1']);
      await createPostWithTags(prisma, ['explicit', 'tag1']);
      await createPostWithTags(prisma, ['rating:explicit', 'tag1']);
      await createPostWithTags(prisma, ['tag1', 'safe']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=tag1');
      const response = await GET(request);
      const data = await response.json();

      // Only the safe post should be returned
      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should be case insensitive for post hiding', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'nsfw';
      clearPatternCache();

      await createPostWithTags(prisma, ['NSFW', 'tag1']);
      await createPostWithTags(prisma, ['Nsfw', 'tag1']);
      await createPostWithTags(prisma, ['tag1', 'safe']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=tag1');
      const response = await GET(request);
      const data = await response.json();

      // Only the safe post should be returned (case insensitive match)
      expect(data.posts).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it('should return all posts when HIDE_POSTS_WITH_TAGS is empty', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = '';
      clearPatternCache();

      await createPostWithTags(prisma, ['nsfw', 'tag1']);
      await createPostWithTags(prisma, ['tag1', 'safe']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=tag1');
      const response = await GET(request);
      const data = await response.json();

      // Both posts should be returned when hiding is disabled
      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    it('should hide posts even when searching for the hidden tag directly', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'private_content';
      clearPatternCache();

      await createPostWithTags(prisma, ['private_content', 'art']);

      // Even if user searches for the tag, posts with it should be hidden
      const request = new NextRequest('http://localhost/api/posts/search?tags=private_content');
      const response = await GET(request);
      const data = await response.json();

      expect(data.posts).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should work with both post hiding and tag blacklisting', async () => {
      const prisma = getTestPrisma();
      process.env.HIDE_POSTS_WITH_TAGS = 'hidden_tag';
      clearPatternCache();

      // Post with hidden tag (should be hidden)
      await createPostWithTags(prisma, ['hidden_tag', 'normal']);
      // Post with blacklisted tag (tag can't be searched, but post is visible)
      await createPostWithTags(prisma, ['site:pixiv', 'normal']);
      // Normal post
      await createPostWithTags(prisma, ['normal', 'safe']);

      const request = new NextRequest('http://localhost/api/posts/search?tags=normal');
      const response = await GET(request);
      const data = await response.json();

      // hidden_tag post is excluded, site:pixiv post is included
      expect(data.posts).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });
  });
});
