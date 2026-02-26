import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import { createOpenRouterHandlers, createMockOpenRouterState, type MockOpenRouterState } from '@/test/mocks/openrouter-server';
import { setupServer, type SetupServer } from 'msw/node';

// Mock admin session verification to bypass auth in tests
vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

describe('Admin Models API', () => {
  let server: SetupServer;
  let openRouterState: MockOpenRouterState;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    openRouterState = createMockOpenRouterState();
    server = setupServer(...createOpenRouterHandlers(openRouterState));
    server.listen();
  });

  afterAll(async () => {
    server.close();
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    openRouterState.modelsError = undefined;
  });

  it('should return 400 when custom endpoint not configured', async () => {
    const { GET } = await import('@/app/api/admin/models/route');
    const response = await GET();

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Local endpoint');
  });

  it('should return models from the custom endpoint without API key', async () => {
    const prisma = getTestPrisma();

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEYS.LOCAL_BASE_URL },
      update: { value: 'https://example.com/v1' },
      create: { key: SETTINGS_KEYS.LOCAL_BASE_URL, value: 'https://example.com/v1' },
    });

    const { GET } = await import('@/app/api/admin/models/route');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.models).toEqual([
      { id: 'custom-model-1', name: 'Custom Model 1' },
      { id: 'custom-model-2', name: 'Custom Model 2' },
    ]);
  });

  it('should pass through upstream error status', async () => {
    const prisma = getTestPrisma();

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEYS.LOCAL_BASE_URL },
      update: { value: 'https://example.com/v1' },
      create: { key: SETTINGS_KEYS.LOCAL_BASE_URL, value: 'https://example.com/v1' },
    });

    openRouterState.modelsError = { message: 'Unauthorized', status: 401 };

    const { GET } = await import('@/app/api/admin/models/route');
    const response = await GET();

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('401');
  });
});
