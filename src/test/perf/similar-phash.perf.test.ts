import { describe, it, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset, seedPhashes } from './seeders';
import { benchmarkWithStats, assertPerformance } from './helpers';

// Dynamic import to ensure prisma injection works
let similarGET: typeof import('@/app/api/similar/route').GET;

/**
 * Perceptual-hash similarity benchmarks. Hamming distance over
 * bit_count(XOR) is an inherent linear scan of PhashEntry, so this
 * tracks how that scan cost grows with the dataset.
 */
describe('Performance: Similar-image phash search', () => {
  let sourceHashes: string[] = [];
  let hashIndex = 0;
  const nextHash = () => sourceHashes[hashIndex++ % sourceHashes.length];

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    await seedPhashes(prisma);
    await prisma.$executeRawUnsafe('ANALYZE');

    const posts = await prisma.post.findMany({
      select: { hash: true },
      orderBy: { id: 'asc' },
      take: 16,
    });
    sourceHashes = posts.map((p) => p.hash);

    similarGET = (await import('@/app/api/similar/route')).GET;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('completes default-threshold search under 150ms p95', async () => {
    const s = await benchmarkWithStats(
      'Phash similar search (threshold 10)',
      async () => {
        const request = new NextRequest(
          `http://localhost/api/similar?hash=${nextHash()}`
        );
        await similarGET(request);
      },
      { iterations: 50, warmup: 5 }
    );

    assertPerformance(s, { p95: 150 });
  });

  it('completes loose-threshold search (more matches) under 200ms p95', async () => {
    const s = await benchmarkWithStats(
      'Phash similar search (threshold 24)',
      async () => {
        const request = new NextRequest(
          `http://localhost/api/similar?hash=${nextHash()}&threshold=24&limit=100`
        );
        await similarGET(request);
      },
      { iterations: 50, warmup: 5 }
    );

    assertPerformance(s, { p95: 200 });
  });
});
