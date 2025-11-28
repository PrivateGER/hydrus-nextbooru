import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createSyncState } from '../factories';

let GET: typeof import('@/app/api/admin/sync/route').GET;
let DELETE: typeof import('@/app/api/admin/sync/route').DELETE;

describe('/api/admin/sync (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/admin/sync/route');
    GET = module.GET;
    DELETE = module.DELETE;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
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

  // Note: POST is not tested here as it triggers background sync
  // which requires mocking the Hydrus client
});
