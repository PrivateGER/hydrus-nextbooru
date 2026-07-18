import { describe, it, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset } from './seeders';
import { benchmarkWithStats, assertPerformance, assertScaling, stats, formatStats } from './helpers';

// Dynamic import to ensure prisma injection works
let getPostsByHashRotation: typeof import('@/lib/random-order').getPostsByHashRotation;

/**
 * Random-order browsing benchmarks (hash-rotation keyset pagination).
 * Guards the fix that replaced table-wide seeded sorts.
 */
describe('Performance: Random-order browsing', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    await prisma.$executeRawUnsafe('ANALYZE');

    getPostsByHashRotation = (await import('@/lib/random-order')).getPostsByHashRotation;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('serves the first page under 50ms p95', async () => {
    const prisma = getTestPrisma();
    let iteration = 0;

    const s = await benchmarkWithStats(
      'Random order (page 1)',
      async () => {
        await getPostsByHashRotation({
          page: 1,
          pageSize: 48,
          seed: `perf-${iteration++ % 8}`,
          prisma,
        });
      },
      { iterations: 300, warmup: 10 }
    );

    assertPerformance(s, { p95: 50 });
  });

  it('keeps deep pages within 3x of page 1', async () => {
    const prisma = getTestPrisma();
    const results: Record<string, ReturnType<typeof stats>> = {};

    for (const page of [1, 10, 25]) {
      const times: number[] = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        await getPostsByHashRotation({
          page,
          pageSize: 48,
          seed: `perf-${i % 8}`,
          prisma,
        });
        times.push(performance.now() - start);
      }
      results[`page ${page}`] = stats(times);
    }

    console.log('\nRandom order pagination:');
    console.table(
      Object.fromEntries(Object.entries(results).map(([k, v]) => [k, formatStats(v)]))
    );

    assertScaling(results['page 1'], results['page 25'], { maxRatio: 3, absoluteCeilingMs: 50 });
  });

  it('handles wrap-around pages past the cursor under 100ms p95', async () => {
    const prisma = getTestPrisma();
    const totalPosts = await prisma.post.count();
    // A page near the end of the rotation forces the wrap-around branch.
    const lastPage = Math.max(1, Math.ceil(totalPosts / 48));
    let iteration = 0;

    const s = await benchmarkWithStats(
      'Random order (wrap-around page)',
      async () => {
        await getPostsByHashRotation({
          page: lastPage,
          pageSize: 48,
          seed: `perf-${iteration++ % 8}`,
          prisma,
        });
      },
      { iterations: 150, warmup: 10 }
    );

    assertPerformance(s, { p95: 100 });
  });
});
