import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, randomHash } from '../factories';

let GET: typeof import('@/app/api/similar/route').GET;

describe('GET /api/similar (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    const routeModule = await import('@/app/api/similar/route');
    GET = routeModule.GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // Helper to create a post with a phash entry
  async function createPostWithPhash(phash: bigint, overrides: Parameters<typeof createPost>[1] = {}) {
    const prisma = getTestPrisma();
    const post = await createPost(prisma, { mimeType: 'image/jpeg', extension: '.jpg', ...overrides });
    await prisma.phashEntry.create({
      data: { hash: post.hash, phash },
    });
    return post;
  }

  describe('input validation', () => {
    it('should reject missing hash', async () => {
      const request = new NextRequest('http://localhost/api/similar');
      const response = await GET(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/hash required/i);
    });

    it('should reject invalid hash format', async () => {
      const request = new NextRequest('http://localhost/api/similar?hash=not-a-hash');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('should reject short hash', async () => {
      const request = new NextRequest('http://localhost/api/similar?hash=abcdef1234');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });

  describe('post lookup', () => {
    it('should return 404 for nonexistent post', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/similar?hash=${hash}`);
      const response = await GET(request);
      expect(response.status).toBe(404);
    });

    it('should return 422 for post without phash', async () => {
      const prisma = getTestPrisma();
      const post = await createPost(prisma);
      const request = new NextRequest(`http://localhost/api/similar?hash=${post.hash}`);
      const response = await GET(request);
      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toMatch(/perceptual hash/i);
    });
  });

  describe('hamming distance search', () => {
    it('should find exact matches (distance 0)', async () => {
      const phash = 0x123456789ABCDEF0n;
      const source = await createPostWithPhash(phash);
      const match = await createPostWithPhash(phash);

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=0`);
      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].hash).toBe(match.hash);
      expect(data.results[0].distance).toBe(0);
    });

    it('should exclude the source post from results', async () => {
      const phash = 0x7EDCBA9876543210n; // must fit signed 64-bit range
      const source = await createPostWithPhash(phash);

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=64`);
      const response = await GET(request);
      const data = await response.json();

      const resultHashes = data.results.map((r: { hash: string }) => r.hash);
      expect(resultHashes).not.toContain(source.hash);
    });

    it('should find posts within threshold and exclude those outside', async () => {
      // Source hash
      const sourcePhash = 0n;
      const source = await createPostWithPhash(sourcePhash);

      // 3 bits different — should match with threshold=5
      const closePhash = 0b111n;
      await createPostWithPhash(closePhash);

      // 10 bits different — should NOT match with threshold=5
      const farPhash = 0b1111111111n;
      await createPostWithPhash(farPhash);

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=5`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(1);
      expect(data.results[0].distance).toBe(3);
    });

    it('should order results by distance ascending', async () => {
      const sourcePhash = 0n;
      const source = await createPostWithPhash(sourcePhash);

      // 5 bits
      await createPostWithPhash(0b11111n);
      // 1 bit
      await createPostWithPhash(0b1n);
      // 3 bits
      await createPostWithPhash(0b111n);

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=10`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(3);
      expect(data.results[0].distance).toBe(1);
      expect(data.results[1].distance).toBe(3);
      expect(data.results[2].distance).toBe(5);
    });

    it('should respect the limit parameter', async () => {
      const sourcePhash = 0n;
      const source = await createPostWithPhash(sourcePhash);

      // Create 5 matches
      for (let i = 0; i < 5; i++) {
        await createPostWithPhash(BigInt(1 << i)); // each 1 bit different
      }

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=5&limit=3`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(3);
    });

    it('should handle negative BigInt phashes (signed 64-bit)', async () => {
      // PostgreSQL BIGINT is signed — high bit set makes it negative
      const sourcePhash = -1n; // all bits set (0xFFFFFFFFFFFFFFFF as signed)
      const source = await createPostWithPhash(sourcePhash);

      // Flip 2 bits → distance 2
      const closePhash = -4n; // 0xFFFFFFFFFFFFFFFC
      await createPostWithPhash(closePhash);

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=5`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(1);
      expect(data.results[0].distance).toBeLessThanOrEqual(5);
    });

    it('should return empty results when nothing matches', async () => {
      const source = await createPostWithPhash(0n);
      await createPostWithPhash(-1n); // all bits set = max distance (64 bits) from 0

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=5`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results).toHaveLength(0);
    });

    it('should return post metadata in results', async () => {
      const phash = 0xABCDn;
      const source = await createPostWithPhash(phash);
      const match = await createPostWithPhash(phash, {
        width: 1920,
        height: 1080,
        mimeType: 'image/png',
        extension: '.png',
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      });

      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=0`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.results[0]).toEqual({
        id: match.id,
        hash: match.hash,
        width: 1920,
        height: 1080,
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        mimeType: 'image/png',
        distance: 0,
      });
    });
  });

  describe('threshold clamping', () => {
    it('should clamp threshold to 0-64 range', async () => {
      const source = await createPostWithPhash(0n);

      // Negative threshold should be clamped to 0
      const request = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=-5`);
      const response = await GET(request);
      expect(response.status).toBe(200);

      // Threshold > 64 should be clamped to 64
      const request2 = new NextRequest(`http://localhost/api/similar?hash=${source.hash}&threshold=999`);
      const response2 = await GET(request2);
      expect(response2.status).toBe(200);
    });
  });
});
