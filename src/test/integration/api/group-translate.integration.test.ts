import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createGroup } from '../factories';
import { createOpenRouterHandlers, createMockOpenRouterState, setTranslationResponse, type MockOpenRouterState } from '@/test/mocks/openrouter-server';
import { invalidateAllCaches } from '@/lib/cache';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import { SourceType } from '@/generated/prisma/client';
import { setupServer } from 'msw/node';
import type { SetupServer } from 'msw/node';

describe('Group Translation API', () => {
  let server: SetupServer;
  let openRouterState: MockOpenRouterState;

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
    invalidateAllCaches();

    const prisma = getTestPrisma();

    // Set up OpenRouter API key in settings
    await prisma.settings.upsert({
      where: { key: SETTINGS_KEYS.API_KEY },
      update: { value: 'test-api-key' },
      create: {
        key: SETTINGS_KEYS.API_KEY,
        value: 'test-api-key',
      },
    });

    // Add OpenRouter handlers to the server
    openRouterState = createMockOpenRouterState();
    server = setupServer(...createOpenRouterHandlers(openRouterState));
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.close();
  });

  it('should translate a group title via API', async () => {
    const prisma = getTestPrisma();

    const group = await createGroup(prisma, SourceType.TITLE, 'hash123', '日本語タイトル');
    expect(group.titleHash).toMatch(/^[a-f0-9]{64}$/);

    setTranslationResponse(openRouterState, 'Japanese Title', 'Japanese');

    // Translate via API
    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request(`http://localhost/api/groups/${group.id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: String(group.id) }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.translatedTitle).toBe('Japanese Title');
    expect(data.sourceLanguage).toBe('ja');
    expect(data.targetLanguage).toBe('en');

    // Verify translation was stored in ContentTranslation table
    const translation = await prisma.contentTranslation.findUnique({
      where: { contentHash: group.titleHash! },
    });
    expect(translation).not.toBeNull();
    expect(translation!.translatedContent).toBe('Japanese Title');
  });

  it('should return 404 for non-existent group', async () => {
    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request('http://localhost/api/groups/99999/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: '99999' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Group not found');
  });

  it('should return 400 for group without title', async () => {
    const prisma = getTestPrisma();

    // Create group without title
    const group = await createGroup(prisma, SourceType.PIXIV, '12345');

    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request(`http://localhost/api/groups/${group.id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: String(group.id) }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Group has no title to translate');
  });

  it('should return 400 for invalid group ID', async () => {
    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request('http://localhost/api/groups/invalid/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid' }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid group ID');
  });

  it('should share translation across groups with identical titles', async () => {
    const prisma = getTestPrisma();
    const sharedTitle = '共有タイトル';

    // Create two groups with the same title
    const group1 = await createGroup(prisma, SourceType.TITLE, 'hash1', sharedTitle);
    const group2 = await createGroup(prisma, SourceType.TITLE, 'hash2', sharedTitle);

    // Both should have the same titleHash
    expect(group1.titleHash).toBe(group2.titleHash);

    setTranslationResponse(openRouterState, 'Shared Title', 'Japanese');

    // Translate only the first group
    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request(`http://localhost/api/groups/${group1.id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await POST(request, { params: Promise.resolve({ id: String(group1.id) }) });

    // Both groups should have access to the same translation via relation
    const groupsWithTranslation = await prisma.group.findMany({
      where: { title: sharedTitle },
      include: { translation: true },
    });

    expect(groupsWithTranslation).toHaveLength(2);
    expect(groupsWithTranslation[0].translation).not.toBeNull();
    expect(groupsWithTranslation[0].translation!.translatedContent).toBe('Shared Title');
    expect(groupsWithTranslation[1].translation).not.toBeNull();
    expect(groupsWithTranslation[1].translation!.translatedContent).toBe('Shared Title');

    // Should only have one translation record in the database
    const translations = await prisma.contentTranslation.findMany();
    expect(translations).toHaveLength(1);
  });

  it('should update existing translation on re-translate', async () => {
    const prisma = getTestPrisma();

    const group = await createGroup(prisma, SourceType.TITLE, 'hash123', 'タイトル');

    const { POST } = await import('@/app/api/groups/[id]/translate/route');

    // First translation
    setTranslationResponse(openRouterState, 'Initial Translation', 'Japanese');
    await POST(
      new Request(`http://localhost/api/groups/${group.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: String(group.id) }) }
    );

    // Second translation (updated)
    setTranslationResponse(openRouterState, 'Updated Translation', 'Japanese');
    await POST(
      new Request(`http://localhost/api/groups/${group.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: String(group.id) }) }
    );

    // Should only have one translation record (upserted)
    const translations = await prisma.contentTranslation.findMany();
    expect(translations).toHaveLength(1);
    expect(translations[0].translatedContent).toBe('Updated Translation');
  });

  it('should return 401 when API key not configured', async () => {
    const prisma = getTestPrisma();

    // Remove the API key
    await prisma.settings.deleteMany({ where: { key: SETTINGS_KEYS.API_KEY } });

    const group = await createGroup(prisma, SourceType.TITLE, 'hash123', 'タイトル');

    const { POST } = await import('@/app/api/groups/[id]/translate/route');
    const request = new Request(`http://localhost/api/groups/${group.id}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: String(group.id) }) });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toContain('API key');
  });
});
