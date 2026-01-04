import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createMockHydrusServer, createMockHydrusState, addFilesToState, type MockHydrusState } from '@/test/mocks/hydrus-server';
import { createMockFileWithNotes } from '@/test/mocks/fixtures/hydrus-metadata';
import { createOpenRouterHandlers, createMockOpenRouterState, setTranslationResponse, setEmptyTranslation, type MockOpenRouterState } from '@/test/mocks/openrouter-server';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import { SETTINGS_KEYS } from '@/lib/openrouter/types';
import type { SetupServer } from 'msw/node';

let syncFromHydrus: typeof import('@/lib/hydrus/sync').syncFromHydrus;

describe('Notes Integration', () => {
  let server: SetupServer;
  let hydrusState: MockHydrusState;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    const syncModule = await import('@/lib/hydrus/sync');
    syncFromHydrus = syncModule.syncFromHydrus;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
    clearPatternCache();

    hydrusState = createMockHydrusState(0);
    server = createMockHydrusServer(hydrusState);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.close();
  });

  describe('note syncing', () => {
    it('should sync notes from Hydrus with content hash', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note 1': 'This is note content', 'Note 2': 'Another note' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const notes = await prisma.note.findMany();
      expect(notes).toHaveLength(2);

      // Verify contentHash is computed (64 char hex string)
      for (const note of notes) {
        expect(note.contentHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should generate same contentHash for identical content', async () => {
      const prisma = getTestPrisma();
      const sharedContent = 'Identical note content across posts';

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': sharedContent },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
        createMockFileWithNotes(
          { 'Note': sharedContent },
          { file_id: 2, hash: 'b'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const notes = await prisma.note.findMany();
      expect(notes).toHaveLength(2);

      // Both notes should have the same contentHash
      expect(notes[0].contentHash).toBe(notes[1].contentHash);
    });

    it('should generate different contentHash for different content', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': 'First content' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
        createMockFileWithNotes(
          { 'Note': 'Second content' },
          { file_id: 2, hash: 'b'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const notes = await prisma.note.findMany();
      expect(notes).toHaveLength(2);

      // Notes should have different contentHash
      expect(notes[0].contentHash).not.toBe(notes[1].contentHash);
    });
  });

  describe('shared translations via API', () => {
    let openRouterState: MockOpenRouterState;

    beforeEach(async () => {
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
      server.use(...createOpenRouterHandlers(openRouterState));
    });

    it('should create a translation via API', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': 'Japanese text here' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const note = await prisma.note.findFirst();
      expect(note).not.toBeNull();

      setTranslationResponse(openRouterState, 'English translation', 'Japanese');

      // Translate via API
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: String(note!.id) }) });
      expect(response.status).toBe(200);

      // Verify translation was stored
      const translation = await prisma.contentTranslation.findUnique({
        where: { contentHash: note!.contentHash },
      });
      expect(translation).not.toBeNull();
      expect(translation!.translatedContent).toBe('English translation');
    });

    it('should share translation across notes with identical content', async () => {
      const prisma = getTestPrisma();
      const sharedContent = 'Shared Japanese text';

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': sharedContent },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
        createMockFileWithNotes(
          { 'Note': sharedContent },
          { file_id: 2, hash: 'b'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const notes = await prisma.note.findMany({ orderBy: { id: 'asc' } });
      expect(notes).toHaveLength(2);
      expect(notes[0].contentHash).toBe(notes[1].contentHash);

      setTranslationResponse(openRouterState, 'Shared English translation', 'Japanese');

      // Translate only the first note via API
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await POST(request, { params: Promise.resolve({ id: String(notes[0].id) }) });

      // Both notes should have access to the same translation via relation
      const notesWithTranslation = await prisma.note.findMany({
        include: { translation: true },
        orderBy: { id: 'asc' },
      });

      expect(notesWithTranslation).toHaveLength(2);
      expect(notesWithTranslation[0].translation).not.toBeNull();
      expect(notesWithTranslation[0].translation!.translatedContent).toBe('Shared English translation');
      expect(notesWithTranslation[1].translation).not.toBeNull();
      expect(notesWithTranslation[1].translation!.translatedContent).toBe('Shared English translation');

      // Should only have one translation record in the database
      const translations = await prisma.contentTranslation.findMany();
      expect(translations).toHaveLength(1);
    });

    it('should not affect other notes when translating unique content', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': 'Unique content A' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
        createMockFileWithNotes(
          { 'Note': 'Unique content B' },
          { file_id: 2, hash: 'b'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const notes = await prisma.note.findMany({ orderBy: { id: 'asc' } });
      expect(notes).toHaveLength(2);

      setTranslationResponse(openRouterState, 'Translation for A', 'Japanese');

      // Translate only the first note via API
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await POST(request, { params: Promise.resolve({ id: String(notes[0].id) }) });

      // Fetch notes with translations
      const notesWithTranslation = await prisma.note.findMany({
        include: { translation: true },
        orderBy: { id: 'asc' },
      });

      // First note should have translation
      expect(notesWithTranslation[0].translation).not.toBeNull();
      expect(notesWithTranslation[0].translation!.translatedContent).toBe('Translation for A');

      // Second note should not have translation (different content hash)
      expect(notesWithTranslation[1].translation).toBeNull();
    });

    it('should upsert translation when re-translating via API', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': 'Content to translate' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const note = await prisma.note.findFirst();
      const { POST } = await import('@/app/api/notes/[id]/translate/route');

      // First translation
      setTranslationResponse(openRouterState, 'First translation', 'Japanese');
      await POST(
        new Request('http://localhost/api/notes/1/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: String(note!.id) }) }
      );

      // Re-translate with different response
      setTranslationResponse(openRouterState, 'Updated translation', 'Japanese');
      await POST(
        new Request('http://localhost/api/notes/1/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: String(note!.id) }) }
      );

      // Should only have one translation record (upserted)
      const translations = await prisma.contentTranslation.findMany();
      expect(translations).toHaveLength(1);
      expect(translations[0].translatedContent).toBe('Updated translation');
    });

    it('should preserve translations when notes are re-synced', async () => {
      const prisma = getTestPrisma();
      const content = 'Persistent content';

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': content },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const noteBefore = await prisma.note.findFirst();

      setTranslationResponse(openRouterState, 'Preserved translation', 'Japanese');

      // Translate via API
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      await POST(
        new Request('http://localhost/api/notes/1/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: String(noteBefore!.id) }) }
      );

      // Re-sync (notes get deleted and recreated)
      await syncFromHydrus();

      // Translation should still exist and be linked to the new note
      const noteAfter = await prisma.note.findFirst({
        include: { translation: true },
      });

      expect(noteAfter).not.toBeNull();
      expect(noteAfter!.contentHash).toBe(noteBefore!.contentHash);
      expect(noteAfter!.translation).not.toBeNull();
      expect(noteAfter!.translation!.translatedContent).toBe('Preserved translation');
    });
  });

  describe('translate API error handling', () => {
    let openRouterState: MockOpenRouterState;

    beforeEach(async () => {
      const prisma = getTestPrisma();

      await prisma.settings.upsert({
        where: { key: SETTINGS_KEYS.API_KEY },
        update: { value: 'test-api-key' },
        create: {
          key: SETTINGS_KEYS.API_KEY,
          value: 'test-api-key',
        },
      });

      openRouterState = createMockOpenRouterState();
      server.use(...createOpenRouterHandlers(openRouterState));
    });

    it('should return 404 for non-existent note', async () => {
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/99999/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: '99999' }) });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid note ID', async () => {
      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/invalid/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'invalid' }) });

      expect(response.status).toBe(400);
    });

    it('should handle empty translation from OpenRouter', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithNotes(
          { 'Note': 'Content that returns empty translation' },
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      const note = await prisma.note.findFirst();
      setEmptyTranslation(openRouterState, true);

      const { POST } = await import('@/app/api/notes/[id]/translate/route');
      const request = new Request('http://localhost/api/notes/1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: String(note!.id) }) });

      // The OpenRouter client falls back to the full response if translation portion is empty
      // This is intentional: better to store something than nothing
      expect(response.status).toBe(200);

      // Verify the full response was stored as fallback
      const translation = await prisma.contentTranslation.findUnique({
        where: { contentHash: note!.contentHash },
      });
      expect(translation).not.toBeNull();
      // Falls back to full response when translation portion is empty
      expect(translation!.translatedContent).toBe('LANGUAGE: Japanese\nTRANSLATION:');
    });
  });
});