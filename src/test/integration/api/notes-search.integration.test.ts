import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, createNote, createPostWithNote } from '../factories';
import { searchNotes } from '@/lib/search';

describe('searchNotes (Integration)', () => {
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

  describe('content search', () => {
    it('should find notes matching content', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'Hello world this is a test note' });
      await createPostWithNote(prisma, { content: 'Another note without the keyword' });

      const result = await searchNotes('hello', 1);

      expect(result.notes).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.notes[0].content).toContain('Hello world');
    });

    it('should be case insensitive', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'UPPERCASE content here' });

      const result = await searchNotes('uppercase', 1);

      expect(result.notes).toHaveLength(1);
    });

    it('should find multiple matching notes', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'First note about cats' });
      await createPostWithNote(prisma, { content: 'Second note about cats too' });
      await createPostWithNote(prisma, { content: 'Note about dogs' });

      const result = await searchNotes('cats', 1);

      expect(result.notes).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should support multi-word search', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'The quick brown fox jumps over the lazy dog' });
      await createPostWithNote(prisma, { content: 'Quick service at the restaurant' });

      const result = await searchNotes('quick fox', 1);

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].content).toContain('brown fox');
    });
  });

  describe('translation search', () => {
    it('should find notes matching translated content', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, {
        content: '日本語のテキスト',
        translatedContent: 'Japanese text translated to English',
      });
      await createPostWithNote(prisma, { content: 'Regular English note' });

      const result = await searchNotes('Japanese', 1);

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].content).toBe('日本語のテキスト');
    });

    it('should find notes when search matches original content', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, {
        content: 'Original Japanese 日本語',
        translatedContent: 'Translated version',
      });

      const result = await searchNotes('Japanese', 1);

      expect(result.notes).toHaveLength(1);
    });

    it('should find notes matching either content or translation', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, {
        content: 'Content with keyword alpha',
        translatedContent: 'Translation without it',
      });
      await createPostWithNote(prisma, {
        content: 'Content without it',
        translatedContent: 'Translation with keyword alpha',
      });
      await createPostWithNote(prisma, {
        content: 'Neither has the word',
        translatedContent: 'Still no match',
      });

      const result = await searchNotes('alpha', 1);

      expect(result.notes).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should handle notes without translations', async () => {
      const prisma = getTestPrisma();
      // Note has no translatedContent field set
      await createPostWithNote(prisma, {
        content: 'Original text in Japanese 日本語',
      });

      // Search for something only in a hypothetical translation
      const result = await searchNotes('hypothetical', 1);

      expect(result.notes).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    it('should paginate results correctly', async () => {
      const prisma = getTestPrisma();
      for (let i = 0; i < 5; i++) {
        await createPostWithNote(prisma, { content: `Test note number ${i} about widgets` });
      }

      const page1 = await searchNotes('widgets', 1);

      expect(page1.notes.length).toBeLessThanOrEqual(48);
      expect(page1.totalCount).toBe(5);
      expect(page1.totalPages).toBe(1);
    });

    it('should return correct page when multiple pages exist', async () => {
      const prisma = getTestPrisma();
      // Create enough notes to span multiple pages (48 per page)
      for (let i = 0; i < 50; i++) {
        await createPostWithNote(prisma, { content: `Common keyword note ${i}` });
      }

      const page1 = await searchNotes('keyword', 1);
      const page2 = await searchNotes('keyword', 2);

      expect(page1.totalCount).toBe(50);
      expect(page1.totalPages).toBe(2);
      expect(page1.notes).toHaveLength(48);
      expect(page2.notes).toHaveLength(2);

      // Verify different notes on different pages
      const page1Ids = page1.notes.map(n => n.id);
      const page2Ids = page2.notes.map(n => n.id);
      expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
    });
  });

  describe('empty and edge cases', () => {
    it('should return empty when no notes match', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'Some unrelated content' });

      const result = await searchNotes('nonexistent', 1);

      expect(result.notes).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should return empty when no notes exist', async () => {
      const result = await searchNotes('anything', 1);

      expect(result.notes).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should handle hyphenated words in search', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'This note has a well-known phrase' });

      const result = await searchNotes('well-known', 1);

      expect(result.notes).toHaveLength(1);
    });
  });

  describe('response format', () => {
    it('should return correct note fields', async () => {
      const prisma = getTestPrisma();
      const { note } = await createPostWithNote(prisma, {
        name: 'Test Note Name',
        content: 'Searchable content here',
      });

      const result = await searchNotes('searchable', 1);

      expect(result.notes[0]).toMatchObject({
        id: note.id,
        name: 'Test Note Name',
        content: 'Searchable content here',
      });
      expect(result.notes[0].headline).toBeDefined();
    });

    it('should return correct post fields', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(
        prisma,
        { content: 'Note content for post test' },
        { width: 1920, height: 1080, mimeType: 'image/jpeg' }
      );

      const result = await searchNotes('post test', 1);

      expect(result.notes[0].post).toMatchObject({
        id: expect.any(Number),
        hash: expect.any(String),
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg',
      });
    });

    it('should include query timing', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, { content: 'Timing test content' });

      const result = await searchNotes('timing', 1);

      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('headline highlighting', () => {
    it('should return headline with match markers', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, {
        content: 'This is a longer text with the keyword somewhere in the middle of it',
      });

      const result = await searchNotes('keyword', 1);

      expect(result.notes[0].headline).toContain('<mark>');
      expect(result.notes[0].headline).toContain('</mark>');
      expect(result.notes[0].headline).toContain('keyword');
    });

    it('should show headline from translation when translation matches', async () => {
      const prisma = getTestPrisma();
      await createPostWithNote(prisma, {
        content: '元のテキスト',
        translatedContent: 'The translated text contains searchterm here',
      });

      const result = await searchNotes('searchterm', 1);

      expect(result.notes[0].headline).toContain('<mark>');
      expect(result.notes[0].headline).toContain('searchterm');
    });
  });

  describe('ranking', () => {
    it('should rank better matches higher', async () => {
      const prisma = getTestPrisma();
      // Create notes with varying relevance
      await createPostWithNote(prisma, {
        name: 'Low relevance',
        content: 'This note mentions testing once',
      });
      await createPostWithNote(prisma, {
        name: 'High relevance',
        content: 'Testing testing testing - this is all about testing',
      });

      const result = await searchNotes('testing', 1);

      expect(result.notes).toHaveLength(2);
      // Higher relevance note should come first
      expect(result.notes[0].name).toBe('High relevance');
    });
  });

  describe('multiple notes per post', () => {
    it('should find multiple notes on same post', async () => {
      const prisma = getTestPrisma();
      const post = await createPost(prisma);
      await createNote(prisma, post.id, { name: 'Note 1', content: 'First note about dragons' });
      await createNote(prisma, post.id, { name: 'Note 2', content: 'Second note about dragons' });

      const result = await searchNotes('dragons', 1);

      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].postId).toBe(post.id);
      expect(result.notes[1].postId).toBe(post.id);
    });
  });
});
