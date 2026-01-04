import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createGroup } from '../factories';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import { SourceType } from '@/generated/prisma/client';

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
      expect(data.status).toBe('idle');
    });
  });
});
