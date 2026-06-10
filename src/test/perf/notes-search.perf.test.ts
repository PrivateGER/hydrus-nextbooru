import { describe, it, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset, seedNotes } from './seeders';
import { benchmarkWithStats, assertPerformance } from './helpers';

// Dynamic import to ensure prisma injection works
let searchNotes: typeof import('@/lib/search').searchNotes;

/**
 * Full-text note search benchmarks (tsvector over note content with
 * ranked headlines). Notes are seeded on ~30% of posts with synthetic
 * vocabulary, so queries hit a realistic mix of common and rare words.
 */
describe('Performance: Notes search', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    await seedNotes(prisma);
    await prisma.$executeRawUnsafe('ANALYZE');

    searchNotes = (await import('@/lib/search')).searchNotes;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('completes a common single-word search under 150ms p95', async () => {
    const s = await benchmarkWithStats(
      'Notes search (common word)',
      async () => {
        await searchNotes('sunset', 1);
      },
      { iterations: 50, warmup: 5 }
    );

    assertPerformance(s, { p95: 150 });
  });

  it('completes a multi-word search under 300ms p95', async () => {
    // Looser bound: multi-word queries pay for ts_headline over a high
    // match rate (small synthetic vocabulary), which dominates the cost.
    const s = await benchmarkWithStats(
      'Notes search (two words)',
      async () => {
        await searchNotes('sunset river', 1);
      },
      { iterations: 50, warmup: 5 }
    );

    assertPerformance(s, { p95: 300 });
  });

  it('completes a deep page under 200ms p95', async () => {
    const s = await benchmarkWithStats(
      'Notes search (page 5)',
      async () => {
        await searchNotes('sunset', 5);
      },
      { iterations: 30, warmup: 3 }
    );

    assertPerformance(s, { p95: 200 });
  });
});
