import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createGroup } from '../factories';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import { SourceType } from '@/generated/prisma/client';
import { NextRequest } from 'next/server';
import { resetTranslationProgress } from '@/app/api/admin/translations/route';
import { createOpenRouterHandlers, createMockOpenRouterState, setTranslationResponse, type MockOpenRouterState } from '@/test/mocks/openrouter-server';
import { setupServer, type SetupServer } from 'msw/node';
import { invalidateAllCaches } from '@/lib/cache';

// Mock admin session verification to bypass auth in tests
vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

/**
 * Poll the translation status until it's no longer running.
 * Returns the final status object.
 */
async function waitForTranslationComplete(
  maxWaitMs = 5000,
  pollIntervalMs = 50
): Promise<{ status: string; [key: string]: unknown }> {
  const { GET } = await import('@/app/api/admin/translations/route');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await GET();
    const data = await response.json();

    if (data.status !== 'running') {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Translation did not complete within ${maxWaitMs}ms`);
}

describe('Bulk Translation API', () => {
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
    // Reset in-memory translation state for test isolation
    resetTranslationProgress();
  });

  describe('GET /api/admin/translations/estimate', () => {
    it('should return 401 when API key not configured', async () => {
      const { GET } = await import('@/app/api/admin/translations/estimate/route');
      const response = await GET();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('API key');
    });

    it('should return estimate with zero titles when no groups exist', async () => {
      const prisma = getTestPrisma();

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      const { GET } = await import('@/app/api/admin/translations/estimate/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalUniqueTitles).toBe(0);
      expect(data.untranslatedCount).toBe(0);
      expect(data.estimatedCost).toBe('$0.00');
    });

    it('should count untranslated titles correctly', async () => {
      const prisma = getTestPrisma();

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      // Create groups with titles
      await createGroup(prisma, SourceType.TITLE, 'hash1', '日本語タイトル');
      await createGroup(prisma, SourceType.TITLE, 'hash2', 'Another Title');
      await createGroup(prisma, SourceType.PIXIV, '12345'); // No title

      const { GET } = await import('@/app/api/admin/translations/estimate/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalUniqueTitles).toBe(2);
      expect(data.untranslatedCount).toBe(2);
      expect(data.translatedCount).toBe(0);
    });

    it('should not count already translated titles', async () => {
      const prisma = getTestPrisma();

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      // Create group with title
      const group = await createGroup(prisma, SourceType.TITLE, 'hash1', '日本語タイトル');

      // Add translation for this title
      await prisma.contentTranslation.create({
        data: {
          contentHash: group.titleHash!,
          translatedContent: 'Japanese Title',
          sourceLanguage: 'ja',
          targetLanguage: 'en',
        },
      });

      // Create another untranslated group
      await createGroup(prisma, SourceType.TITLE, 'hash2', 'Untranslated Title');

      const { GET } = await import('@/app/api/admin/translations/estimate/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalUniqueTitles).toBe(2);
      expect(data.translatedCount).toBe(1);
      expect(data.untranslatedCount).toBe(1);
    });
  });

  describe('GET /api/admin/translations', () => {
    it('should return idle progress when not running', async () => {
      const { GET } = await import('@/app/api/admin/translations/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      // Status should be idle since we reset in beforeEach
      expect(data.status).toBe('idle');
    });
  });

  describe('POST /api/admin/translations', () => {
    it('should start bulk translation and return success', async () => {
      await waitForTranslationComplete(); // Ensure clean state

      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Bulk translation started');
      expect(data.status).toBe('running');

      await waitForTranslationComplete();
    });

    it('should handle malformed body gracefully', async () => {
      await waitForTranslationComplete(); // Ensure clean state

      const { POST } = await import('@/app/api/admin/translations/route');

      // Test with invalid JSON - should still start translation with defaults
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
        body: 'not-valid-json',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Bulk translation started');

      await waitForTranslationComplete();
    });

  });

  describe('DELETE /api/admin/translations', () => {
    it('should return 400 when no translation in progress', async () => {
      await waitForTranslationComplete(); // Ensure no translation is running

      const { DELETE } = await import('@/app/api/admin/translations/route');
      const response = await DELETE();

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No translation in progress');
    });
  });

  describe('Translation completion status', () => {
    it('should complete immediately when no untranslated titles exist', async () => {
      const prisma = getTestPrisma();

      // Configure OpenRouter API key so the translation can proceed
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      const status = await waitForTranslationComplete();
      // With OpenRouter configured and no titles to translate, should complete immediately
      expect(status.status).toBe('completed');
    });

    it('should set error status when OpenRouter is not configured', async () => {
      const prisma = getTestPrisma();
      await waitForTranslationComplete(); // Ensure clean state

      // Create a group that needs translation
      await createGroup(prisma, SourceType.TITLE, 'test-hash-unconfigured', 'Test Title');

      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      const status = await waitForTranslationComplete();
      // Should be error since OpenRouter is not configured
      expect(status.status).toBe('error');

      // Validate errors array structure before asserting on length
      expect(status.errors).toBeDefined();
      expect(Array.isArray(status.errors)).toBe(true);
      const errors = status.errors as unknown[];
      expect(errors.every((e) => typeof e === 'string')).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Duplicate title deduplication', () => {
    let server: SetupServer;
    let openRouterState: MockOpenRouterState;

    beforeEach(async () => {
      invalidateAllCaches();

      // Set up OpenRouter mock server
      openRouterState = createMockOpenRouterState();
      server = setupServer(...createOpenRouterHandlers(openRouterState));
      server.listen({ onUnhandledRequest: 'error' });
    });

    afterEach(() => {
      server.close();
    });

    it('should only make one API call for multiple groups with the same title', async () => {
      const prisma = getTestPrisma();
      await waitForTranslationComplete(); // Ensure clean state

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      const sharedTitle = '共有タイトル';

      // Create 3 groups with the same title
      const group1 = await createGroup(prisma, SourceType.TITLE, 'hash1', sharedTitle);
      const group2 = await createGroup(prisma, SourceType.TITLE, 'hash2', sharedTitle);
      const group3 = await createGroup(prisma, SourceType.TITLE, 'hash3', sharedTitle);

      // Verify all groups have the same titleHash
      expect(group1.titleHash).toBe(group2.titleHash);
      expect(group2.titleHash).toBe(group3.titleHash);

      // Set up mock response
      setTranslationResponse(openRouterState, 'Shared Title', 'Japanese');

      // Run bulk translation
      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      const status = await waitForTranslationComplete();
      expect(status.status).toBe('completed');

      // Verify only 1 API call was made (not 3)
      expect(openRouterState.callCount).toBe(1);

      // Verify only 1 translation record exists
      const translations = await prisma.contentTranslation.findMany();
      expect(translations).toHaveLength(1);
      expect(translations[0].translatedContent).toBe('Shared Title');

      // Verify all groups share the same translation via the relationship
      const groupsWithTranslation = await prisma.group.findMany({
        where: { title: sharedTitle },
        include: { translation: true },
      });

      expect(groupsWithTranslation).toHaveLength(3);
      for (const group of groupsWithTranslation) {
        expect(group.translation).not.toBeNull();
        expect(group.translation!.translatedContent).toBe('Shared Title');
      }
    });

    it('should make separate API calls for groups with different titles', async () => {
      const prisma = getTestPrisma();
      await waitForTranslationComplete(); // Ensure clean state

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      // Create 3 groups with different titles
      await createGroup(prisma, SourceType.TITLE, 'hash1', '日本語タイトル1');
      await createGroup(prisma, SourceType.TITLE, 'hash2', '日本語タイトル2');
      await createGroup(prisma, SourceType.TITLE, 'hash3', '日本語タイトル3');

      // Set up mock response
      setTranslationResponse(openRouterState, 'Translated Title', 'Japanese');

      // Run bulk translation
      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      const status = await waitForTranslationComplete();
      expect(status.status).toBe('completed');

      // Verify 3 API calls were made (one per unique title)
      expect(openRouterState.callCount).toBe(3);

      // Verify 3 translation records exist
      const translations = await prisma.contentTranslation.findMany();
      expect(translations).toHaveLength(3);
    });

    it('should count unique titles correctly in estimate when duplicates exist', async () => {
      const prisma = getTestPrisma();

      // Configure API key
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: { key: SETTINGS_KEYS.API_KEY, value: 'test-api-key' },
      });

      const sharedTitle = '同じタイトル';

      // Create 5 groups with the same title and 2 groups with unique titles
      await createGroup(prisma, SourceType.TITLE, 'hash1', sharedTitle);
      await createGroup(prisma, SourceType.TITLE, 'hash2', sharedTitle);
      await createGroup(prisma, SourceType.TITLE, 'hash3', sharedTitle);
      await createGroup(prisma, SourceType.TITLE, 'hash4', sharedTitle);
      await createGroup(prisma, SourceType.TITLE, 'hash5', sharedTitle);
      await createGroup(prisma, SourceType.TITLE, 'hash6', '別のタイトル');
      await createGroup(prisma, SourceType.TITLE, 'hash7', 'Another Title');

      const { GET } = await import('@/app/api/admin/translations/estimate/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should count 3 unique titles (sharedTitle, 別のタイトル, Another Title), not 7
      expect(data.untranslatedCount).toBe(3);
    });
  });
});
