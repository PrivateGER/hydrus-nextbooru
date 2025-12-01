import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset, getRandomTagNames } from './seeders';
import { benchmarkWithStats, assertPerformance, stats, formatStats } from './helpers';

// Dynamic import to ensure prisma injection works
let GET: typeof import('@/app/api/posts/search/route').GET;

describe('Performance: Post Search API', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Seed dataset (size controlled by PERF_DATASET_SIZE env var)
    await seedDataset(prisma);

    // Dynamic import after Prisma is set up
    const module = await import('@/app/api/posts/search/route');
    GET = module.GET;
  }, 180_000); // 3 minutes for container + seeding

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  describe('single tag search', () => {
    it('should complete single tag search under 100ms p95', async () => {
      const prisma = getTestPrisma();
      const [tag] = await getRandomTagNames(prisma, 1, 100);

      const s = await benchmarkWithStats(
        `Single tag search (tag=${tag})`,
        async () => {
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${encodeURIComponent(tag)}`
          );
          await GET(request);
        },
        { iterations: 100, warmup: 10 }
      );

      assertPerformance(s, { p95: 100 });
    });

    it('should scale with result count', async () => {
      const prisma = getTestPrisma();

      // Get tags with varying post counts
      const popularTags = await prisma.tag.findMany({
        where: { postCount: { gte: 200 } },
        orderBy: { postCount: 'desc' },
        take: 3,
        select: { name: true, postCount: true },
      });

      const mediumTags = await prisma.tag.findMany({
        where: { postCount: { gte: 50, lt: 100 } },
        take: 3,
        select: { name: true, postCount: true },
      });

      const rareTags = await prisma.tag.findMany({
        where: { postCount: { gte: 5, lt: 20 } },
        take: 3,
        select: { name: true, postCount: true },
      });

      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const group of [
        { name: 'popular (200+)', tags: popularTags },
        { name: 'medium (50-100)', tags: mediumTags },
        { name: 'rare (5-20)', tags: rareTags },
      ]) {
        if (group.tags.length === 0) continue;

        const tag = group.tags[0];
        const times: number[] = [];

        for (let i = 0; i < 50; i++) {
          const start = performance.now();
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${encodeURIComponent(tag.name)}`
          );
          await GET(request);
          times.push(performance.now() - start);
        }

        results[`${group.name} (${tag.postCount} posts)`] = stats(times);
      }

      console.log('\nPost search by result count:');
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, formatStats(v)])
        )
      );
    });
  });

  describe('multi-tag search (AND logic)', () => {
    it('should complete 2-tag AND search under 150ms p95', async () => {
      const prisma = getTestPrisma();
      const tags = await getRandomTagNames(prisma, 2, 50);
      const tagsParam = tags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        `2-tag AND search (tags=${tags.join(', ')})`,
        async () => {
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${tagsParam}`
          );
          await GET(request);
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 150 });
    });

    it('should complete 3-tag AND search under 200ms p95', async () => {
      const prisma = getTestPrisma();
      const tags = await getRandomTagNames(prisma, 3, 30);
      const tagsParam = tags.map(t => encodeURIComponent(t)).join(',');

      const s = await benchmarkWithStats(
        `3-tag AND search (tags=${tags.join(', ')})`,
        async () => {
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${tagsParam}`
          );
          await GET(request);
        },
        { iterations: 50, warmup: 5 }
      );

      assertPerformance(s, { p95: 200 });
    });

    it('should scale sub-linearly with tag count', async () => {
      const prisma = getTestPrisma();
      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const count of [1, 2, 3, 4, 5]) {
        const tags = await getRandomTagNames(prisma, count, 20);
        const tagsParam = tags.map(t => encodeURIComponent(t)).join(',');

        const times: number[] = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${tagsParam}`
          );
          await GET(request);
          times.push(performance.now() - start);
        }
        results[`${count} tags`] = stats(times);
      }

      console.log('\nPost search scaling by tag count:');
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, formatStats(v)])
        )
      );

      // Verify it doesn't explode exponentially
      const ratio = results['5 tags'].p95 / results['1 tags'].p95;
      console.log(`\n5-tag / 1-tag ratio: ${ratio.toFixed(2)}x`);
      expect(ratio).toBeLessThan(10);
    });
  });

  describe('pagination performance', () => {
    it('should maintain consistent performance across pages', async () => {
      const prisma = getTestPrisma();
      const [tag] = await getRandomTagNames(prisma, 1, 200);

      const results: Record<string, ReturnType<typeof stats>> = {};

      for (const page of [1, 5, 10, 20]) {
        const times: number[] = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          const request = new NextRequest(
            `http://localhost/api/posts/search?tags=${encodeURIComponent(tag)}&page=${page}`
          );
          await GET(request);
          times.push(performance.now() - start);
        }
        results[`page ${page}`] = stats(times);
      }

      console.log('\nPagination performance:');
      console.table(
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, formatStats(v)])
        )
      );

      // Page 20 shouldn't be more than 3x slower than page 1
      const ratio = results['page 20'].p95 / results['page 1'].p95;
      console.log(`\nPage 20 / Page 1 ratio: ${ratio.toFixed(2)}x`);
      expect(ratio).toBeLessThan(3);
    });
  });

  describe('concurrent requests', () => {
    it('should handle 10 concurrent requests gracefully', async () => {
      const prisma = getTestPrisma();
      const tags = await getRandomTagNames(prisma, 10, 50);

      const times: number[] = [];

      for (let batch = 0; batch < 10; batch++) {
        const start = performance.now();

        // Fire 10 concurrent requests with different tags
        await Promise.all(
          tags.map(tag => {
            const request = new NextRequest(
              `http://localhost/api/posts/search?tags=${encodeURIComponent(tag)}`
            );
            return GET(request);
          })
        );

        times.push(performance.now() - start);
      }

      const s = stats(times);
      console.log('\n10 concurrent requests:');
      console.table(formatStats(s));

      // 10 concurrent requests should complete in under 500ms p95
      assertPerformance(s, { p95: 500 });
    });
  });
});
