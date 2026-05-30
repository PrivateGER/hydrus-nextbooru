import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPost } from './factories';
import { getPostsByHashRotation, seedToHexCursor } from '@/lib/random-order';

describe('Random order helpers (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should page through a stable hash rotation without sorting every row by a seeded expression', async () => {
    const prisma = getTestPrisma();
    const seed = 'rotation-seed';
    const cursor = seedToHexCursor(seed, 64);
    const lowerHash = '0'.repeat(64);
    const upperHash = 'f'.repeat(64);

    expect(lowerHash < cursor).toBe(true);
    expect(upperHash >= cursor).toBe(true);

    await createPost(prisma, { hash: lowerHash, hydrusFileId: 1 });
    await createPost(prisma, { hash: upperHash, hydrusFileId: 2 });

    const firstPage = await getPostsByHashRotation({
      page: 1,
      pageSize: 1,
      seed,
      prisma,
    });
    const secondPage = await getPostsByHashRotation({
      page: 2,
      pageSize: 1,
      seed,
      prisma,
    });
    const repeatedFirstPage = await getPostsByHashRotation({
      page: 1,
      pageSize: 1,
      seed,
      prisma,
    });

    expect(firstPage.map((post) => post.hash)).toEqual([upperHash]);
    expect(secondPage.map((post) => post.hash)).toEqual([lowerHash]);
    expect(repeatedFirstPage.map((post) => post.hash)).toEqual([upperHash]);
  });
});
