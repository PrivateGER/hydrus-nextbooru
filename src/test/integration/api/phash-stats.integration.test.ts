import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost } from '../factories';

let getPhashStats: typeof import('@/lib/phash/batch').getPhashStats;

describe('getPhashStats (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    const batchModule = await import('@/lib/phash/batch');
    getPhashStats = batchModule.getPhashStats;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should return all zeros when no posts exist', async () => {
    const stats = await getPhashStats();
    expect(stats).toEqual({
      total: 0,
      withPhash: 0,
      withoutPhash: 0,
      unsupported: 0,
    });
  });

  it('should correctly count posts with phash entries', async () => {
    const prisma = getTestPrisma();

    // 2 image posts with phash
    const post1 = await createPost(prisma, { mimeType: 'image/jpeg', extension: '.jpg' });
    const post2 = await createPost(prisma, { mimeType: 'image/png', extension: '.png' });
    await prisma.phashEntry.createMany({
      data: [
        { hash: post1.hash, phash: 123n },
        { hash: post2.hash, phash: 456n },
      ],
    });

    // 1 image post without phash
    await createPost(prisma, { mimeType: 'image/webp', extension: '.webp' });

    // 1 unsupported post (video)
    await createPost(prisma, { mimeType: 'video/mp4', extension: '.mp4' });

    const stats = await getPhashStats();
    expect(stats.total).toBe(4);
    expect(stats.withPhash).toBe(2);
    expect(stats.withoutPhash).toBe(1);
    expect(stats.unsupported).toBe(1);
  });

  it('should count SVG as unsupported', async () => {
    const prisma = getTestPrisma();
    await createPost(prisma, { mimeType: 'image/svg+xml', extension: '.svg' });

    const stats = await getPhashStats();
    expect(stats.total).toBe(1);
    expect(stats.unsupported).toBe(1);
    expect(stats.withoutPhash).toBe(0);
  });
});
