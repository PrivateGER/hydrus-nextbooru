import { describe, it, beforeAll, afterAll } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  recalculateTagStats,
} from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset } from './seeders';
import { benchmarkWithStats, assertPerformance } from './helpers';

// Dynamic import to ensure prisma injection works
let computeRecommendationsForPost: typeof import('@/lib/recommendations').computeRecommendationsForPost;

/**
 * Recommendation benchmarks for the IDF-weighted similarity SQL function
 * (compute_post_recommendations). This is the uncached compute path —
 * the cost that matters when a post page is first visited.
 */
describe('Performance: Recommendations', () => {
  let postIds: number[] = [];
  let postIndex = 0;
  const nextPostId = () => postIds[postIndex++ % postIds.length];

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    // Recommendations weight tags by IDF; refresh postCount + idfWeight.
    await recalculateTagStats();
    await prisma.$executeRawUnsafe('ANALYZE');

    const posts = await prisma.post.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 32,
    });
    postIds = posts.map((p) => p.id);

    computeRecommendationsForPost = (await import('@/lib/recommendations'))
      .computeRecommendationsForPost;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('computes recommendations for a post under 500ms p95', async () => {
    const s = await benchmarkWithStats(
      'Recommendations (uncached compute)',
      async () => {
        await computeRecommendationsForPost(nextPostId(), 10);
      },
      { iterations: 200, warmup: 10 }
    );

    assertPerformance(s, { p95: 500 });
  });
});
