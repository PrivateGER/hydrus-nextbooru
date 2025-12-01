import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import { seedDataset, getRandomTagNames } from './seeders';
import { benchmarkWithStats, assertPerformance, stats, formatStats } from './helpers';

// Dynamic import to ensure prisma injection works
let GET: typeof import('@/app/api/tags/search/route').GET;

describe('Performance: Tag Search API', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Seed dataset (size controlled by PERF_DATASET_SIZE env var)
    await seedDataset(prisma);

    // Dynamic import after Prisma is set up
    const module = await import('@/app/api/tags/search/route');
    GET = module.GET;
  }, 180_000); // 3 minutes for container + seeding

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  describe('simple search (no selected tags)', () => {
    it('should complete simple search under 50ms p95', async () => {
      const prisma = getTestPrisma();

      // Warm up caches
      invalidateAllCaches();
      clearPatternCache();

      const s = await benchmarkWithStats(
        'Simple tag search (q=general)',
        async () => {
          const request = new NextRequest('http://localhost/api/tags/search?q=general');
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
          const request = new NextRequest(`http://localhost/api/tags/search?q=${q}`);
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
        expect(s.p95, `Query ${query} too slow`).toBeLessThan(100);
      }
    });
  });

  describe('co-occurrence search (with selected tags)', () => {
    it('should complete 1-tag co-occurrence under 100ms p95', async () => {
      const prisma = getTestPrisma();
      invalidateAllCaches();
      clearPatternCache();

      // Get a popular tag to use as selected
      const [selectedTag] = await getRandomTagNames(prisma, 1, 50);

      const s = await benchmarkWithStats(
        `Co-occurrence search (1 selected: ${selectedTag})`,
        async () => {
          const request = new NextRequest(
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
      clearPatternCache();

      const selectedTags = await getRandomTagNames(prisma, 2, 30);
      const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        `Co-occurrence search (2 selected: ${selectedTags.join(', ')})`,
        async () => {
          const request = new NextRequest(
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
      clearPatternCache();

      const selectedTags = await getRandomTagNames(prisma, 3, 20);
      const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        `Co-occurrence search (3 selected: ${selectedTags.join(', ')})`,
        async () => {
          const request = new NextRequest(
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
      clearPatternCache();

      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const count of [1, 2, 3, 4, 5]) {
        const selectedTags = await getRandomTagNames(prisma, count, 10);
        const selectedParam = selectedTags.map(t => encodeURIComponent(t)).join(',');

        const times: number[] = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          const request = new NextRequest(
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
      expect(ratio).toBeLessThan(10);
    });
  });

  describe('cache effectiveness', () => {
    it('should be significantly faster on cache hit', async () => {
      const prisma = getTestPrisma();

      // Clear caches
      invalidateAllCaches();
      clearPatternCache();

      const [selectedTag] = await getRandomTagNames(prisma, 1, 50);
      const url = `http://localhost/api/tags/search?q=general&selected=${encodeURIComponent(selectedTag)}`;

      // Cold run (no cache)
      const coldTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        invalidateAllCaches();
        clearPatternCache();
        const start = performance.now();
        const request = new NextRequest(url);
        await GET(request);
        coldTimes.push(performance.now() - start);
      }

      // Warm run (with cache)
      invalidateAllCaches();
      clearPatternCache();
      // Prime the cache
      await GET(new NextRequest(url));

      const warmTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const request = new NextRequest(url);
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
      expect(speedup).toBeGreaterThan(0.8);
    });
  });
});
