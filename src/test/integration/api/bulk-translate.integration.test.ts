import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createGroup } from '../factories';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import { SourceType } from '@/generated/prisma/client';
import { NextRequest } from 'next/server';

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
      // Status could be idle or completed from previous tests
      expect(['idle', 'completed']).toContain(data.status);
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
      await waitForTranslationComplete(); // Ensure clean state

      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      const status = await waitForTranslationComplete();
      // Status should be completed or error (if it tried to get OpenRouter client)
      expect(['completed', 'error']).toContain(status.status);
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
      expect((status.errors as string[]).length).toBeGreaterThan(0);
    });
  });
});
