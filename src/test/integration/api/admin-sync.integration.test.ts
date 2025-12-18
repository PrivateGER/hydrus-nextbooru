import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createSyncState } from '../factories';
import { createMockHydrusServer, createMockHydrusState, addFilesToState, type MockHydrusState } from '@/test/mocks/hydrus-server';
import { createMockFileMetadata } from '@/test/mocks/fixtures/hydrus-metadata';
import type { SetupServer } from 'msw/node';

let GET: typeof import('@/app/api/admin/sync/route').GET;
let POST: typeof import('@/app/api/admin/sync/route').POST;
let DELETE: typeof import('@/app/api/admin/sync/route').DELETE;

describe('/api/admin/sync (Integration)', () => {
  let server: SetupServer;
  let hydrusState: MockHydrusState;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/admin/sync/route');
    GET = module.GET;
    POST = module.POST;
    DELETE = module.DELETE;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create fresh mock state and server for each test
    hydrusState = createMockHydrusState(0);
    server = createMockHydrusServer(hydrusState);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.close();
  });

  describe('GET - sync status', () => {
    it('should return idle status when no sync state exists', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('idle');
      expect(data.lastSyncedAt).toBeNull();
      expect(data.lastSyncCount).toBe(0);
    });

    it('should return current sync state', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'running', {
        totalFiles: 100,
        processedFiles: 50,
        currentBatch: 2,
        totalBatches: 4,
      });

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('running');
      expect(data.totalFiles).toBe(100);
      expect(data.processedFiles).toBe(50);
      expect(data.currentBatch).toBe(2);
      expect(data.totalBatches).toBe(4);
    });

    it('should return last sync info after completion', async () => {
      const prisma = getTestPrisma();
      const syncDate = new Date('2024-01-15T10:00:00Z');
      await createSyncState(prisma, 'completed', {
        lastSyncedAt: syncDate,
        lastSyncCount: 500,
      });

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('completed');
      expect(data.lastSyncedAt).toBe(syncDate.toISOString());
      expect(data.lastSyncCount).toBe(500);
    });

    it('should return error message on failed sync', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'error', {
        errorMessage: 'Connection timeout',
      });

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(data.errorMessage).toBe('Connection timeout');
    });
  });

  describe('DELETE - cancel sync', () => {
    it('should cancel running sync', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'running');

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Sync cancellation requested');

      // Verify state was updated
      const syncState = await prisma.syncState.findFirst();
      expect(syncState?.status).toBe('cancelled');
    });

    it('should return message when no running sync', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'idle');

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('No running sync to cancel');
    });

    it('should not affect non-running syncs', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'completed');

      const response = await DELETE();
      const data = await response.json();

      expect(data.message).toBe('No running sync to cancel');

      // Verify state unchanged
      const syncState = await prisma.syncState.findFirst();
      expect(syncState?.status).toBe('completed');
    });
  });

  describe('POST - start sync', () => {
    it('should return 409 if sync is already running', async () => {
      const prisma = getTestPrisma();
      await createSyncState(prisma, 'running');

      const request = new NextRequest('http://localhost/api/admin/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Sync is already running');
    });

    it('should start sync and return success', async () => {
      // Add some files to mock Hydrus
      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
      ]);

      const request = new NextRequest('http://localhost/api/admin/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Sync started');
      expect(data.tags).toEqual(['system:everything']);

      // Wait for background sync to complete
      await waitForSyncToComplete();

      // Verify sync actually ran and created data
      const prisma = getTestPrisma();
      const posts = await prisma.post.findMany();
      expect(posts).toHaveLength(1);
      expect(posts[0].hash).toBe('a'.repeat(64));
    });
  });
});

// Helper to wait for background sync to complete
async function waitForSyncToComplete(timeoutMs = 5000): Promise<void> {
  const { prisma } = await import('@/lib/db');
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const state = await prisma.syncState.findFirst();
    if (!state || state.status === 'completed' || state.status === 'error') {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error('Sync did not complete within timeout');
}
