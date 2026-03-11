import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost } from '../factories';

// Mock admin session verification to bypass auth in tests
vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

// Mock batchComputePhashes to avoid needing real image files on disk
vi.mock('@/lib/phash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/phash')>();
  return {
    ...actual,
    batchComputePhashes: vi.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 }),
  };
});

let GET: typeof import('@/app/api/admin/phash/route').GET;
let POST: typeof import('@/app/api/admin/phash/route').POST;
let DELETE: typeof import('@/app/api/admin/phash/route').DELETE;

describe('/api/admin/phash (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const routeModule = await import('@/app/api/admin/phash/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
    DELETE = routeModule.DELETE;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET - phash stats', () => {
    it('should return stats with all zeros when no posts exist', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(0);
      expect(data.withPhash).toBe(0);
      expect(data.withoutPhash).toBe(0);
      expect(data.unsupported).toBe(0);
      expect(data.batchRunning).toBe(false);
      expect(data.batchProgress).toBeNull();
    });

    it('should return correct counts for mixed post states', async () => {
      const prisma = getTestPrisma();

      // Post with phash
      const post1 = await createPost(prisma, { mimeType: 'image/jpeg', extension: '.jpg' });
      await prisma.phashEntry.create({ data: { hash: post1.hash, phash: 42n } });

      // Image post without phash
      await createPost(prisma, { mimeType: 'image/png', extension: '.png' });

      // Unsupported post
      await createPost(prisma, { mimeType: 'video/mp4', extension: '.mp4' });

      const response = await GET();
      const data = await response.json();

      expect(data.total).toBe(3);
      expect(data.withPhash).toBe(1);
      expect(data.withoutPhash).toBe(1);
      expect(data.unsupported).toBe(1);
    });
  });

  describe('POST - start batch computation', () => {
    it('should start batch computation and return accepted', async () => {
      const request = new NextRequest('http://localhost/api/admin/phash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toMatch(/started/i);
    });

    it('should accept custom limit and batchSize', async () => {
      const request = new NextRequest('http://localhost/api/admin/phash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100, batchSize: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.limit).toBe(100);
      expect(data.batchSize).toBe(25);
    });
  });

  describe('DELETE - reset phashes', () => {
    it('should require resetAll flag', async () => {
      const request = new NextRequest('http://localhost/api/admin/phash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/resetAll/);
    });

    it('should delete all phash entries when resetAll is true', async () => {
      const prisma = getTestPrisma();

      // Create posts with phash entries
      const post1 = await createPost(prisma, { mimeType: 'image/jpeg', extension: '.jpg' });
      const post2 = await createPost(prisma, { mimeType: 'image/png', extension: '.png' });
      await prisma.phashEntry.createMany({
        data: [
          { hash: post1.hash, phash: 111n },
          { hash: post2.hash, phash: 222n },
        ],
      });

      // Verify they exist
      expect(await prisma.phashEntry.count()).toBe(2);

      const request = new NextRequest('http://localhost/api/admin/phash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAll: true }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(2);
      expect(await prisma.phashEntry.count()).toBe(0);
    });

    it('should return count 0 when no phash entries exist', async () => {
      const request = new NextRequest('http://localhost/api/admin/phash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAll: true }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(0);
    });
  });
});
