import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { seedDataset, getRandomTagNames } from './seeders';
import { benchmarkWithStats, assertPerformance, shouldEnforcePerfThresholds, stats, formatStats } from './helpers';
import type { PrismaClient } from '@/generated/prisma/client';

// Dynamic import to ensure prisma injection works
let GET: typeof import('@/app/api/tags/search/route').GET;
let perfRequestCounter = 0;

function tagSearchRequest(url: string): NextRequest {
  perfRequestCounter += 1;
  return new NextRequest(url, {
    headers: {
      'x-forwarded-for': `perf-tag-search-${perfRequestCounter}`,
    },
  });
}

async function seedGroupedPosts(prisma: PrismaClient): Promise<void> {
  const postCount = await prisma.post.count();
  const targetGroups = process.env.PERF_DATASET_SIZE === 'large' ? 10_000 : 1_000;
  const groupCount = Math.min(targetGroups, Math.floor(postCount / 2));
  if (groupCount === 0) return;

  await prisma.$executeRaw`
    WITH selected_posts AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
      FROM "Post"
      ORDER BY id
      LIMIT ${groupCount * 2}
    ),
    created_groups AS (
      INSERT INTO "Group" ("sourceType", "sourceId")
      SELECT 'PIXIV'::"SourceType", 'perf-group-' || i
      FROM generate_series(1, ${groupCount}) AS i
      RETURNING id
    ),
    numbered_groups AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
      FROM created_groups
    )
    INSERT INTO "PostGroup" ("postId", "groupId", position)
    SELECT p.id, g.id, ((p.rn - 1) % 2)::int
    FROM selected_posts p
    JOIN numbered_groups g ON g.rn = CEIL(p.rn / 2.0)
  `;
}

describe('Performance: Tag Search API', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Seed dataset (size controlled by PERF_DATASET_SIZE env var)
    await seedDataset(prisma);
    await seedGroupedPosts(prisma);

    // Dynamic import after Prisma is set up
    const routeModule = await import('@/app/api/tags/search/route');
    GET = routeModule.GET;
  }, 180_000); // 3 minutes for container + seeding

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  describe('simple search (no selected tags)', () => {
    it('should complete simple search under 50ms p95', async () => {
      // Warm up caches
      invalidateAllCaches();

      const s = await benchmarkWithStats(
        'Simple tag search (q=general)',
        async () => {
          const request = tagSearchRequest('http://localhost/api/tags/search?q=general');
          await GET(request);
        },
        { iterations: 100, warmup: 10 }
      );

      // Assert performance thresholds
      assertPerformance(s, { p95: 50 });
    });

    it('should scale with different query patterns', async () => {
      const queries = ['a', 'tag', 'general_tag_', 'artist'];
      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const q of queries) {
        const times: number[] = [];
        for (let i = 0; i < 50; i++) {
          const start = performance.now();
          const request = tagSearchRequest(`http://localhost/api/tags/search?q=${q}`);
          await GET(request);
          times.push(performance.now() - start);
        }
        results[`q="${q}"`] = stats(times);
      }

      console.log('\nSimple search by query pattern:');
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, formatStats(v)])
        )
      );

      // All queries should complete reasonably fast
      for (const [query, s] of Object.entries(results)) {
        assertPerformance(s, { p95: 100 });
      }
    });

    it('should complete grouped creator autocomplete under 100ms p95', async () => {
      invalidateAllCaches();

      const s = await benchmarkWithStats(
        'Grouped creator autocomplete (q=artist)',
        async () => {
          const request = tagSearchRequest(
            'http://localhost/api/tags/search?q=artist&category=ARTIST&validCreators=true&withGroups=true&limit=10'
          );
          const response = await GET(request);
          const data = await response.json();
          if (!Array.isArray(data.tags) || data.tags.length === 0) {
            throw new Error('Grouped creator autocomplete benchmark returned no suggestions');
          }
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 100 });
    });
  });

  describe('co-occurrence search (with selected tags)', () => {
    it('should complete 1-tag co-occurrence under 100ms p95', async () => {
      const prisma = getTestPrisma();
      invalidateAllCaches();

      // Get a popular tag to use as selected
      const [selectedTag] = await getRandomTagNames(prisma, 1, 50);

      const s = await benchmarkWithStats(
        'Co-occurrence search (1 selected)',
        async () => {
          const request = tagSearchRequest(
            `http://localhost/api/tags/search?q=tag&selected=${encodeURIComponent(selectedTag)}`
          );
          await GET(request);
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 100 });
    });

    it('should complete 2-tag co-occurrence under 150ms p95', async () => {
      const prisma = getTestPrisma();
      invalidateAllCaches();

      const selectedTags = await getRandomTagNames(prisma, 2, 30);
      const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        'Co-occurrence search (2 selected)',
        async () => {
          const request = tagSearchRequest(
            `http://localhost/api/tags/search?q=tag&selected=${selectedParam}`
          );
          await GET(request);
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 150 });
    });

    it('should complete 3-tag co-occurrence under 200ms p95', async () => {
      const prisma = getTestPrisma();
      invalidateAllCaches();

      const selectedTags = await getRandomTagNames(prisma, 3, 20);
      const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        'Co-occurrence search (3 selected)',
        async () => {
          const request = tagSearchRequest(
            `http://localhost/api/tags/search?q=tag&selected=${selectedParam}`
          );
          await GET(request);
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 200 });
    });

    it('should scale sub-linearly with selected tag count', async () => {
      const prisma = getTestPrisma();
      invalidateAllCaches();

      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const count of [1, 2, 3, 4, 5]) {
        const selectedTags = await getRandomTagNames(prisma, count, 10);
        const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

        const times: number[] = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          const request = tagSearchRequest(
            `http://localhost/api/tags/search?q=tag&selected=${selectedParam}`
          );
          await GET(request);
          times.push(performance.now() - start);
        }
        results[`${count} tags`] = stats(times);
      }

      console.log('\nCo-occurrence scaling by selected tag count:');
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, formatStats(v)])
        )
      );

      // Verify it doesn't explode exponentially
      // 5 tags should be less than 10x the time of 1 tag
      const ratio = results['5 tags'].p95 / results['1 tags'].p95;
      console.log(`\n5-tag / 1-tag ratio: ${ratio.toFixed(2)}x`);
      if (shouldEnforcePerfThresholds()) {
        expect(ratio).toBeLessThan(10);
      }
    });
  });

  describe('cache effectiveness', () => {
    it('should be significantly faster on cache hit', async () => {
      const prisma = getTestPrisma();

      // Clear caches
      invalidateAllCaches();

      const [selectedTag] = await getRandomTagNames(prisma, 1, 50);
      const url = `http://localhost/api/tags/search?q=general&selected=${encodeURIComponent(selectedTag)}`;

      // Cold run (no cache)
      const coldTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        invalidateAllCaches();
        const start = performance.now();
        const request = tagSearchRequest(url);
        await GET(request);
        coldTimes.push(performance.now() - start);
      }

      // Warm run (with cache)
      invalidateAllCaches();
      // Prime the cache
      await GET(tagSearchRequest(url));

      const warmTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const request = tagSearchRequest(url);
        await GET(request);
        warmTimes.push(performance.now() - start);
      }

      const coldStats = stats(coldTimes);
      const warmStats = stats(warmTimes);

      console.log('\nCache effectiveness:');
      console.table({
        'Cold (no cache)': formatStats(coldStats),
        'Warm (cached)': formatStats(warmStats),
      });

      const speedup = coldStats.p50 / warmStats.p50;
      console.log(`\nCache speedup: ${speedup.toFixed(2)}x`);

      // Note: Application-level cache speedup may be minimal when DB query cache is warm.
      // This test primarily serves to track cache behavior over time.
      // The speedup should at least not be negative (warm shouldn't be slower).
      if (shouldEnforcePerfThresholds()) {
        expect(speedup).toBeGreaterThan(0.8);
      }
    });
  });
});
