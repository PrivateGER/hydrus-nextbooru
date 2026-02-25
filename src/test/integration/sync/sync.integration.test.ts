import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createMockHydrusServer, createMockHydrusState, addFilesToState, removeFilesFromState, type MockHydrusState } from '@/test/mocks/hydrus-server';
import { createMockFileMetadata, createMockFileWithTags, createMockFileWithUrls } from '@/test/mocks/fixtures/hydrus-metadata';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';
import type { SetupServer } from 'msw/node';

let syncFromHydrus: typeof import('@/lib/hydrus/sync').syncFromHydrus;
let getSyncState: typeof import('@/lib/hydrus/sync').getSyncState;

describe('syncFromHydrus (Integration)', () => {
  let server: SetupServer;
  let hydrusState: MockHydrusState;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Import after setting up test prisma
    const syncModule = await import('@/lib/hydrus/sync');
    syncFromHydrus = syncModule.syncFromHydrus;
    getSyncState = syncModule.getSyncState;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
    clearPatternCache();

    // Create fresh mock state and server for each test
    hydrusState = createMockHydrusState(0);
    server = createMockHydrusServer(hydrusState);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe('basic sync', () => {
    it('should sync files from Hydrus to database', async () => {
      const prisma = getTestPrisma();

      // Setup: 3 files with tags
      addFilesToState(hydrusState, [
        createMockFileWithTags(['tag1', 'artist:alice'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileWithTags(['tag1', 'tag2'], { file_id: 2, hash: 'b'.repeat(64) }),
        createMockFileWithTags(['tag3'], { file_id: 3, hash: 'c'.repeat(64) }),
      ]);

      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.processedFiles).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Verify posts created
      const posts = await prisma.post.findMany();
      expect(posts).toHaveLength(3);

      // Verify tags created
      const tags = await prisma.tag.findMany();
      expect(tags.length).toBeGreaterThanOrEqual(4); // tag1, tag2, tag3, alice

      // Verify post-tag relations
      const postTags = await prisma.postTag.findMany();
      expect(postTags.length).toBeGreaterThan(0);
    });

    it('should update existing posts on re-sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);

      // First sync
      addFilesToState(hydrusState, [
        createMockFileWithTags(['tag1'], { file_id: 1, hash, width: 800 }),
      ]);
      await syncFromHydrus();

      const postBefore = await prisma.post.findUnique({ where: { hash } });
      expect(postBefore?.width).toBe(800);

      // Update file metadata
      hydrusState.metadata.set(1, createMockFileWithTags(['tag1', 'tag2'], {
        file_id: 1,
        hash,
        width: 1920, // Changed
      }));

      // Re-sync
      await syncFromHydrus();

      const postAfter = await prisma.post.findUnique({ where: { hash } });
      expect(postAfter?.width).toBe(1920);

      // Verify tags updated
      const postTags = await prisma.postTag.findMany({
        where: { postId: postAfter!.id },
        include: { tag: true },
      });
      expect(postTags).toHaveLength(2);
    });

    it('should skip unchanged relations on re-sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);

      // First sync with tags and URL (for groups)
      addFilesToState(hydrusState, [
        {
          ...createMockFileWithTags(['tag1', 'artist:alice'], { file_id: 1, hash }),
          known_urls: ['https://www.pixiv.net/en/artworks/12345'],
          notes: { 'note1': 'Test note content' },
        },
      ]);
      await syncFromHydrus();

      const post = await prisma.post.findUnique({ where: { hash } });
      expect(post).not.toBeNull();

      // Get original relation records
      const originalPostTags = await prisma.postTag.findMany({
        where: { postId: post!.id },
        orderBy: { tagId: 'asc' },
      });
      const originalPostGroups = await prisma.postGroup.findMany({
        where: { postId: post!.id },
        orderBy: { groupId: 'asc' },
      });
      const originalNotes = await prisma.note.findMany({
        where: { postId: post!.id },
        orderBy: { name: 'asc' },
      });

      expect(originalPostTags.length).toBeGreaterThan(0);
      expect(originalPostGroups.length).toBeGreaterThan(0);
      expect(originalNotes.length).toBeGreaterThan(0);

      // Re-sync with SAME data (no changes to tags/groups/notes)
      await syncFromHydrus();

      // Get relation records after re-sync
      const afterPostTags = await prisma.postTag.findMany({
        where: { postId: post!.id },
        orderBy: { tagId: 'asc' },
      });
      const afterPostGroups = await prisma.postGroup.findMany({
        where: { postId: post!.id },
        orderBy: { groupId: 'asc' },
      });
      const afterNotes = await prisma.note.findMany({
        where: { postId: post!.id },
        orderBy: { name: 'asc' },
      });

      // Relations should be identical (not recreated)
      expect(afterPostTags).toEqual(originalPostTags);
      expect(afterPostGroups).toEqual(originalPostGroups);
      expect(afterNotes.map(n => ({ name: n.name, content: n.content })))
        .toEqual(originalNotes.map(n => ({ name: n.name, content: n.content })));
    });

    it('should handle empty Hydrus library', async () => {
      // No files added to state
      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
    });

    it('should create groups from source URLs', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithUrls(
          ['https://www.pixiv.net/en/artworks/12345678'],
          { file_id: 1, hash: 'a'.repeat(64) }
        ),
        createMockFileWithUrls(
          ['https://www.pixiv.net/en/artworks/12345678'], // Same pixiv work
          { file_id: 2, hash: 'b'.repeat(64) }
        ),
      ]);

      await syncFromHydrus();

      // Verify group created
      const groups = await prisma.group.findMany();
      expect(groups).toHaveLength(1);
      expect(groups[0].sourceType).toBe('PIXIV');
      expect(groups[0].sourceId).toBe('12345678');

      // Verify both posts linked to group
      const postGroups = await prisma.postGroup.findMany();
      expect(postGroups).toHaveLength(2);
    });
  });

  describe('concurrency control', () => {
    it('should throw if sync is already running', async () => {
      const prisma = getTestPrisma();

      // Create running sync state
      await prisma.syncState.create({
        data: {
          status: 'running',
          totalFiles: 100,
          processedFiles: 50,
          currentBatch: 1,
          totalBatches: 2,
        },
      });

      await expect(syncFromHydrus()).rejects.toThrow('already in progress');
    });

    it('should allow sync after previous completed', async () => {
      const prisma = getTestPrisma();

      // Create completed sync state
      await prisma.syncState.create({
        data: {
          status: 'completed',
          lastSyncedAt: new Date(),
          lastSyncCount: 10,
        },
      });

      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
      ]);

      const result = await syncFromHydrus();
      expect(result.phase).toBe('complete');
    });

    it('should allow sync after previous errored', async () => {
      const prisma = getTestPrisma();

      // Create errored sync state
      await prisma.syncState.create({
        data: {
          status: 'error',
          errorMessage: 'Previous error',
        },
      });

      const result = await syncFromHydrus();
      expect(result.phase).toBe('complete');
    });
  });

  describe('error handling', () => {
    it('should handle Hydrus search API errors', async () => {
      hydrusState.searchError = new Error('Connection refused');

      await expect(syncFromHydrus()).rejects.toThrow();

      // Verify error state recorded
      const state = await getSyncState();
      expect(state?.status).toBe('error');
      expect(state?.errorMessage).toBeTruthy();
    });

    it('should record batch errors without stopping sync', async () => {
      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
      ]);
      hydrusState.metadataError = new Error('Metadata fetch failed');

      // Batch errors don't throw - they're recorded and sync continues
      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Error processing batch');
    });
  });

  describe('sync state tracking', () => {
    it('should update progress during sync', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileMetadata({ file_id: 2, hash: 'b'.repeat(64) }),
      ]);

      await syncFromHydrus();

      const state = await prisma.syncState.findFirst();
      expect(state?.status).toBe('completed');
      expect(state?.lastSyncCount).toBe(2);
      expect(state?.lastSyncedAt).not.toBeNull();
    });

    it('should track progress via callback', async () => {
      // Create files to sync
      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileMetadata({ file_id: 2, hash: 'b'.repeat(64) }),
        createMockFileMetadata({ file_id: 3, hash: 'c'.repeat(64) }),
      ]);

      const progressUpdates: { phase: string; processedFiles: number }[] = [];

      await syncFromHydrus({
        onProgress: (progress) => {
          progressUpdates.push({
            phase: progress.phase,
            processedFiles: progress.processedFiles,
          });
        },
      });

      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Should have gone through fetching/processing phases
      expect(progressUpdates.some((p) => p.phase === 'fetching' || p.phase === 'processing')).toBe(true);

      // Final update should show all files processed
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.phase).toBe('complete');
      expect(lastUpdate.processedFiles).toBe(3);
    });
  });

  describe('tag handling', () => {
    it('should categorize namespaced tags correctly', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithTags([
          'general tag',
          'artist:john doe',
          'character:alice',
          'series:wonderland',
        ], { file_id: 1, hash: 'a'.repeat(64) }),
      ]);

      const result = await syncFromHydrus();

      // Verify sync completed successfully
      expect(result.phase).toBe('complete');
      expect(result.processedFiles).toBe(1);
      expect(result.errors).toHaveLength(0);

      const tags = await prisma.tag.findMany();

      // Verify tags were created
      expect(tags.length).toBeGreaterThanOrEqual(4);

      const artistTag = tags.find((t) => t.name === 'john doe');
      const characterTag = tags.find((t) => t.name === 'alice');
      const seriesTag = tags.find((t) => t.name === 'wonderland');
      const generalTag = tags.find((t) => t.name === 'general tag');

      expect(artistTag?.category).toBe('ARTIST');
      expect(characterTag?.category).toBe('CHARACTER');
      expect(seriesTag?.category).toBe('COPYRIGHT');
      expect(generalTag?.category).toBe('GENERAL');
    });

    it('should update tag post counts after sync', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileWithTags(['shared tag', 'unique1'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileWithTags(['shared tag', 'unique2'], { file_id: 2, hash: 'b'.repeat(64) }),
        createMockFileWithTags(['shared tag'], { file_id: 3, hash: 'c'.repeat(64) }),
      ]);

      await syncFromHydrus();

      const sharedTag = await prisma.tag.findFirst({ where: { name: 'shared tag' } });
      const uniqueTag = await prisma.tag.findFirst({ where: { name: 'unique1' } });

      expect(sharedTag?.postCount).toBe(3);
      expect(uniqueTag?.postCount).toBe(1);
    });
  });

  describe('deletion cleanup', () => {
    it('should delete posts removed from Hydrus', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();

      // First sync: add 3 files
      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileMetadata({ file_id: 2, hash: 'b'.repeat(64) }),
        createMockFileMetadata({ file_id: 3, hash: 'c'.repeat(64) }),
      ]);
      await syncFromHydrus();

      expect(await prisma.post.count()).toBe(3);

      // Remove file 2 from Hydrus state
      removeFilesFromState(hydrusState, [2]);

      // Re-sync
      const result = await syncFromHydrus();

      expect(await prisma.post.count()).toBe(2);
      expect(await prisma.post.findUnique({ where: { hash: 'b'.repeat(64) } })).toBeNull();
      expect(result.deletedPosts).toBe(1);
    });

    it('should delete orphaned tags after post deletion', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();

      // Sync: file with unique tag
      addFilesToState(hydrusState, [
        createMockFileWithTags(['shared_tag'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileWithTags(['shared_tag', 'unique_tag'], { file_id: 2, hash: 'b'.repeat(64) }),
      ]);
      await syncFromHydrus();

      expect(await prisma.tag.findFirst({ where: { name: 'unique_tag' } })).not.toBeNull();

      // Remove file 2 (which has unique_tag)
      removeFilesFromState(hydrusState, [2]);

      // Re-sync
      const result = await syncFromHydrus();

      // unique_tag should be deleted
      expect(await prisma.tag.findFirst({ where: { name: 'unique_tag' } })).toBeNull();
      // shared_tag should remain
      expect(await prisma.tag.findFirst({ where: { name: 'shared_tag' } })).not.toBeNull();
      expect(result.deletedTags).toBe(1);
    });

    it('should delete orphaned groups after post deletion', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();

      // Sync: two files in same pixiv group, one in unique group
      addFilesToState(hydrusState, [
        createMockFileWithUrls(['https://www.pixiv.net/en/artworks/111'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileWithUrls(['https://www.pixiv.net/en/artworks/111'], { file_id: 2, hash: 'b'.repeat(64) }),
        createMockFileWithUrls(['https://www.pixiv.net/en/artworks/222'], { file_id: 3, hash: 'c'.repeat(64) }),
      ]);
      await syncFromHydrus();

      expect(await prisma.group.count()).toBe(2);

      // Remove file 3 (only member of group 222)
      removeFilesFromState(hydrusState, [3]);

      const result = await syncFromHydrus();

      // Group 222 should be deleted, 111 should remain
      expect(await prisma.group.count()).toBe(1);
      expect(await prisma.group.findFirst({ where: { sourceId: '222' } })).toBeNull();
      expect(result.deletedGroups).toBe(1);
    });

    it('should handle empty Hydrus library (delete all posts)', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();

      // First sync with files
      addFilesToState(hydrusState, [
        createMockFileWithTags(['tag1'], { file_id: 1, hash: 'a'.repeat(64) }),
      ]);
      await syncFromHydrus();
      expect(await prisma.post.count()).toBe(1);
      expect(await prisma.tag.count()).toBeGreaterThan(0);

      // Clear all files from Hydrus
      removeFilesFromState(hydrusState, [1]);

      const result = await syncFromHydrus();

      expect(await prisma.post.count()).toBe(0);
      expect(await prisma.tag.count()).toBe(0);
      expect(result.deletedPosts).toBe(1);
    });

    it('should report deletion counts in progress callback', { timeout: 30000 }, async () => {
      addFilesToState(hydrusState, [
        createMockFileWithTags(['unique_tag'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileMetadata({ file_id: 2, hash: 'b'.repeat(64) }),
      ]);
      await syncFromHydrus();

      // Remove one file
      removeFilesFromState(hydrusState, [1]);

      let cleanupProgress: { deletedPosts?: number; deletedTags?: number } | null = null;
      await syncFromHydrus({
        onProgress: (progress) => {
          if (progress.phase === 'cleanup' || progress.phase === 'complete') {
            cleanupProgress = {
              deletedPosts: progress.deletedPosts,
              deletedTags: progress.deletedTags,
            };
          }
        },
      });

      expect(cleanupProgress).not.toBeNull();
      expect(cleanupProgress!.deletedPosts).toBe(1);
      expect(cleanupProgress!.deletedTags).toBe(1); // unique_tag was orphaned
    });
  });
});
