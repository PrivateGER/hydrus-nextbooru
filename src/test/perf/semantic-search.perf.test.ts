import { describe, it, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset, seedEmbeddings, PERF_EMBEDDING_CONFIG } from './seeders';
import { benchmarkWithStats, assertPerformance } from './helpers';
import { createRng } from './rng';
import { unitVector } from './synthetic';

// Dynamic import to ensure prisma injection works
let searchPostsByEmbedding: typeof import('@/lib/embeddings/store').searchPostsByEmbedding;

/**
 * Vector KNN benchmarks against the vchordrq-indexed PostEmbedding table.
 * Query vectors are pre-generated deterministically so every run measures
 * the same workload.
 */
describe('Performance: Semantic vector search', () => {
  const queryRng = createRng(0x5e4ac);
  const queryVectors = Array.from({ length: 16 }, () =>
    unitVector(PERF_EMBEDDING_CONFIG.dimensions, queryRng)
  );
  let queryIndex = 0;
  const nextQuery = () => queryVectors[queryIndex++ % queryVectors.length];

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    await seedEmbeddings(prisma);
    await prisma.$executeRawUnsafe('ANALYZE');

    searchPostsByEmbedding = (await import('@/lib/embeddings/store')).searchPostsByEmbedding;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('completes capped nearest-neighbor search under 150ms p95', async () => {
    const s = await benchmarkWithStats(
      'Semantic search (capped KNN)',
      async () => {
        await searchPostsByEmbedding({
          config: PERF_EMBEDDING_CONFIG,
          embedding: nextQuery(),
          skip: 0,
          limit: 48,
          resultCap: 288,
        });
      },
      { iterations: 200, warmup: 10 }
    );

    assertPerformance(s, { p95: 150 });
  });

  it('completes deep pagination within the result cap under 150ms p95', async () => {
    const s = await benchmarkWithStats(
      'Semantic search (page 5 of cap)',
      async () => {
        await searchPostsByEmbedding({
          config: PERF_EMBEDDING_CONFIG,
          embedding: nextQuery(),
          skip: 192,
          limit: 48,
          resultCap: 288,
        });
      },
      { iterations: 200, warmup: 10 }
    );

    assertPerformance(s, { p95: 150 });
  });

  it('completes score-filtered search under 150ms p95', async () => {
    const s = await benchmarkWithStats(
      'Semantic search (min-score filtered)',
      async () => {
        await searchPostsByEmbedding({
          config: PERF_EMBEDDING_CONFIG,
          embedding: nextQuery(),
          skip: 0,
          limit: 48,
          minScore: 0.1,
          resultCap: 288,
        });
      },
      { iterations: 200, warmup: 10 }
    );

    assertPerformance(s, { p95: 150 });
  });
});
