import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createMockHydrusServer, createMockHydrusState, addFilesToState, removeFilesFromState, type MockHydrusState } from '@/test/mocks/hydrus-server';
import { createMockFileMetadata, createMockFileWithTags, createMockFileWithUrls } from '@/test/mocks/fixtures/hydrus-metadata';
import { invalidateAllCaches } from '@/lib/cache';
import type { SetupServer } from 'msw/node';

import type * as SyncModule from '@/lib/hydrus/sync';

let syncFromHydrus: typeof SyncModule.syncFromHydrus;
let getSyncState: typeof SyncModule.getSyncState;
let recalculateTagCounts: typeof SyncModule.recalculateTagCounts;

describe('syncFromHydrus (Integration)', () => {
  let server: SetupServer;
  let hydrusState: MockHydrusState;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Dynamic import is deliberate: the module must not be evaluated until
    // setTestPrisma has pointed @/lib/db at the Testcontainers database.
    const syncModule = await import('@/lib/hydrus/sync');
    syncFromHydrus = syncModule.syncFromHydrus;
    getSyncState = syncModule.getSyncState;
    recalculateTagCounts = syncModule.recalculateTagCounts;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();

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
      hydrusState.searchErrorStatusCode = 400;

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
      hydrusState.metadataErrorStatusCode = 400;

      // Batch errors don't throw - they're recorded and sync continues
      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Error processing batch');
    });

    it('should retry transient malformed metadata responses', async () => {
      const prisma = getTestPrisma();

      addFilesToState(hydrusState, [
        createMockFileMetadata({ file_id: 1, hash: 'a'.repeat(64) }),
      ]);
      hydrusState.metadataMalformedJsonResponses = 1;

      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.processedFiles).toBe(1);
      expect(result.errors).toHaveLength(0);

      const post = await prisma.post.findUnique({
        where: { hash: 'a'.repeat(64) },
      });
      expect(post).not.toBeNull();
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

    it('should store tags whose names stress PostgreSQL array-literal escaping', async () => {
      const prisma = getTestPrisma();

      // The bulk tag insert binds names as a text[] parameter (unnest). These
      // names exercise the array-literal escaping rules: quotes, backslashes,
      // commas, braces, and the literal word NULL.
      const nastyTags = [
        'tag with "double quotes"',
        'back\\slash',
        'comma, separated',
        '{curly braces}',
        'null',
        "single 'quotes'",
      ];

      addFilesToState(hydrusState, [
        createMockFileWithTags(nastyTags, { file_id: 1, hash: 'a'.repeat(64) }),
      ]);

      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.processedFiles).toBe(1);
      expect(result.errors).toHaveLength(0);

      const tags = await prisma.tag.findMany({ select: { name: true } });
      const names = new Set(tags.map((t) => t.name));
      for (const tag of nastyTags) {
        expect(names.has(tag)).toBe(true);
      }

      // Relations must resolve through the same escaped names: the exact
      // nasty names must be attached to the post, not merely counted.
      const post = await prisma.post.findUnique({
        where: { hash: 'a'.repeat(64) },
        include: { tags: { include: { tag: true } } },
      });
      const postTagNames = new Set(post?.tags.map((pt) => pt.tag.name));
      for (const tag of nastyTags) {
        expect(postTagNames.has(tag)).toBe(true);
      }
      expect(post?.tags).toHaveLength(nastyTags.length);
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

  describe('re-sync write elimination', () => {
    it('does not rewrite unchanged posts on re-sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);
      const file = {
        ...createMockFileWithTags(['tag1', 'artist:alice'], { file_id: 1, hash }),
        known_urls: [
          'https://www.pixiv.net/en/artworks/12345',
          'https://example.com/original-source',
        ],
        notes: { note1: 'Test note content' },
      };

      addFilesToState(hydrusState, [file]);
      await syncFromHydrus();

      const before = await prisma.post.findUnique({ where: { hash } });
      expect(before).not.toBeNull();

      // Re-sync with identical data: the diff path must not open a write
      // transaction, so Prisma's @updatedAt and syncedAt stay untouched.
      await syncFromHydrus();

      const after = await prisma.post.findUnique({ where: { hash } });
      expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
      expect(after!.syncedAt.getTime()).toBe(before!.syncedAt.getTime());

      // Hydrus documents known_urls as a plain array with no ordering
      // guarantee: a pure reorder is not a change and must not write either.
      hydrusState.metadata.set(1, {
        ...file,
        known_urls: [...file.known_urls].reverse(),
      });
      await syncFromHydrus();

      const afterReorder = await prisma.post.findUnique({ where: { hash } });
      expect(afterReorder!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
      expect(afterReorder!.syncedAt.getTime()).toBe(before!.syncedAt.getTime());
    });

    it('removes dropped tags and notes on re-sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);

      addFilesToState(hydrusState, [
        {
          ...createMockFileWithTags(['tag1', 'tag2'], { file_id: 1, hash }),
          notes: { note1: 'to be removed' },
        },
      ]);
      await syncFromHydrus();

      const post = await prisma.post.findUnique({ where: { hash } });
      expect(await prisma.postTag.count({ where: { postId: post!.id } })).toBe(2);
      expect(await prisma.note.count({ where: { postId: post!.id } })).toBe(1);

      // Hydrus now reports one tag and no notes for the same file.
      hydrusState.metadata.set(1, createMockFileWithTags(['tag1'], { file_id: 1, hash }));
      await syncFromHydrus();

      expect(await prisma.postTag.count({ where: { postId: post!.id } })).toBe(1);
      expect(await prisma.note.count({ where: { postId: post!.id } })).toBe(0);
      // A relation change refreshes syncedAt even without metadata changes.
      const afterPost = await prisma.post.findUnique({ where: { hash } });
      expect(afterPost!.syncedAt.getTime()).toBeGreaterThan(post!.syncedAt.getTime());
    });

    it('recalculateTagCounts writes nothing when stats are already fresh', { timeout: 30000 }, async () => {
      addFilesToState(hydrusState, [
        createMockFileWithTags(['tag1', 'artist:alice'], { file_id: 1, hash: 'a'.repeat(64) }),
        createMockFileWithTags(['tag1', 'tag2'], { file_id: 2, hash: 'b'.repeat(64) }),
      ]);
      // Sync already runs the recalculation at the end.
      await syncFromHydrus();

      // Recomputing over unchanged data must be bitwise-stable and touch
      // zero rows - this is the guard that keeps re-syncs from rewriting
      // the whole Tag and Post tables.
      const counts = await recalculateTagCounts();
      expect(counts).toEqual({
        tagCountUpdates: 0,
        idfWeightUpdates: 0,
        tagIdfNormUpdates: 0,
      });
    });

    it('resets stale idfWeight for postless tags even when the library is empty', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();

      // Orphaned stats survivor: a tag with stale counts and no posts in an
      // empty library (e.g. cleanup was interrupted between post deletion
      // and orphan removal).
      await prisma.tag.create({
        data: { name: 'stale', category: 'GENERAL', postCount: 5, idfWeight: 2.5 },
      });

      await recalculateTagCounts();

      const tag = await prisma.tag.findFirst({ where: { name: 'stale' } });
      expect(tag!.postCount).toBe(0);
      expect(tag!.idfWeight).toBe(0);
    });

    it('rewrites groups and notes when they change on re-sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);
      const file = {
        ...createMockFileWithTags(['tag1'], { file_id: 1, hash }),
        known_urls: ['https://www.pixiv.net/en/artworks/111'],
        notes: { note1: 'v1' },
      };

      addFilesToState(hydrusState, [file]);
      await syncFromHydrus();

      const post = await prisma.post.findUnique({ where: { hash } });
      expect(post).not.toBeNull();

      // Same file now belongs to a different pixiv work and the note text
      // changed: both relation sets must be rewritten, not just diff-skipped.
      hydrusState.metadata.set(1, {
        ...file,
        known_urls: ['https://www.pixiv.net/en/artworks/222'],
        notes: { note1: 'v2' },
      });
      await syncFromHydrus();

      const groups = await prisma.postGroup.findMany({
        where: { postId: post!.id },
        include: { group: true },
      });
      expect(groups).toHaveLength(1);
      expect(groups[0].group.sourceId).toBe('222');

      const notes = await prisma.note.findMany({ where: { postId: post!.id } });
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('v2');
    });
  });

  describe('phash algorithm versioning', () => {
    it('clears stored phashes when the algorithm version changes', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);

      addFilesToState(hydrusState, [createMockFileMetadata({ file_id: 1, hash })]);
      await syncFromHydrus();

      await prisma.phashEntry.create({ data: { hash, phash: 123n } });
      await prisma.settings.update({
        where: { key: 'phash.algorithmVersion' },
        data: { value: 'outdated' },
      });

      await syncFromHydrus();

      expect(await prisma.phashEntry.count()).toBe(0);
      const setting = await prisma.settings.findUnique({
        where: { key: 'phash.algorithmVersion' },
      });
      expect(setting?.value).not.toBe('outdated');
    });

    it('adopts the current version without clearing when none is stored', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hash = 'a'.repeat(64);

      addFilesToState(hydrusState, [createMockFileMetadata({ file_id: 1, hash })]);
      await syncFromHydrus();

      // Simulate a pre-versioning database: entries exist, no version key.
      await prisma.phashEntry.create({ data: { hash, phash: 456n } });
      await prisma.settings.delete({ where: { key: 'phash.algorithmVersion' } });

      await syncFromHydrus();

      // Warm cache preserved; version key adopted.
      expect(await prisma.phashEntry.count()).toBe(1);
      const setting = await prisma.settings.findUnique({
        where: { key: 'phash.algorithmVersion' },
      });
      expect(setting).not.toBeNull();
    });

    it('preserves out-of-scope phashes and the version marker on a filtered sync', { timeout: 30000 }, async () => {
      const prisma = getTestPrisma();
      const hashA = 'a'.repeat(64);
      const hashB = 'b'.repeat(64);

      // Seed two posts via a full sync.
      addFilesToState(hydrusState, [
        createMockFileWithTags(['tag1'], { file_id: 1, hash: hashA }),
        createMockFileWithTags(['other'], { file_id: 2, hash: hashB }),
      ]);
      await syncFromHydrus();

      await prisma.phashEntry.createMany({
        data: [
          { hash: hashA, phash: 111n },
          { hash: hashB, phash: 222n },
        ],
      });
      await prisma.settings.update({
        where: { key: 'phash.algorithmVersion' },
        data: { value: 'outdated' },
      });

      // The mock search handler ignores tag filters, so narrow the mock
      // state itself to file 1 - the filtered sync's scope is exactly post A.
      removeFilesFromState(hydrusState, [2]);
      await syncFromHydrus({ tags: ['tag1'] });

      // Out-of-scope entry byte-identical, in-scope entry not clobbered by a
      // global clear, marker NOT advanced: the global clear is deferred to
      // the next full sync.
      const entryB = await prisma.phashEntry.findUnique({ where: { hash: hashB } });
      expect(entryB?.phash).toBe(222n);
      expect(await prisma.phashEntry.count()).toBe(2);
      const setting = await prisma.settings.findUnique({
        where: { key: 'phash.algorithmVersion' },
      });
      expect(setting?.value).toBe('outdated');
    });
  });
});
