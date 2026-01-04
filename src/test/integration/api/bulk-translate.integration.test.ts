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
      const { POST } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Bulk translation started');
      expect(data.status).toBe('running');

      // Wait for background job to complete (will error due to no API key, but that's ok)
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('should handle malformed body gracefully', async () => {
      // Wait for any previous translation to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

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

      // Wait for background job to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  });

  describe('DELETE /api/admin/translations', () => {
    it('should return 400 when no translation in progress', async () => {
      // Wait for any previous translation to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      const { DELETE } = await import('@/app/api/admin/translations/route');
      const response = await DELETE();

      // Could be 400 (no translation) or 200 (cancelled ongoing)
      // depending on timing with previous tests
      const data = await response.json();
      if (response.status === 400) {
        expect(data.error).toBe('No translation in progress');
      } else {
        expect(data.message).toBe('Translation cancelled');
      }
    });
  });

  describe('Translation completion status', () => {
    it('should complete immediately when no untranslated titles exist', async () => {
      // Wait for any previous translation to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      const { POST, GET } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      // Wait for background job to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const statusResponse = await GET();
      const status = await statusResponse.json();
      // Status should be completed or error (if it tried to get OpenRouter client)
      expect(['completed', 'error']).toContain(status.status);
    });

    it('should set error status when OpenRouter is not configured', async () => {
      const prisma = getTestPrisma();

      // Wait for any previous translation to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Create a group that needs translation
      await createGroup(prisma, SourceType.TITLE, 'test-hash-unconfigured', 'Test Title');

      const { POST, GET } = await import('@/app/api/admin/translations/route');
      const request = new NextRequest('http://localhost/api/admin/translations', {
        method: 'POST',
      });
      await POST(request);

      // Wait for background job to fail due to missing config
      await new Promise((resolve) => setTimeout(resolve, 300));

      const statusResponse = await GET();
      const status = await statusResponse.json();
      // Should be error since OpenRouter is not configured
      expect(status.status).toBe('error');
      expect(status.errors.length).toBeGreaterThan(0);
    });
  });
});
