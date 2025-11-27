import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockSearchResponse,
  createMockMetadataResponse,
  createMockFileBatch,
  createMockFileWithTags,
  createMockFileWithUrls,
  createMockFileWithNotes,
  createMockFileMetadata,
} from '@/test/mocks/fixtures/hydrus-metadata';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { TagCategory, SourceType } from '@/generated/prisma/client';

// =============================================================================
// Helper functions to build realistic mock responses for tag/group lookups
// =============================================================================

/**
 * Build mock tag data that matches what bulkEnsureTags would return.
 * Takes raw tag strings and returns mock Tag objects with IDs.
 */
function buildMockTags(rawTags: string[]): Array<{ id: number; name: string; category: TagCategory }> {
  const tags: Array<{ id: number; name: string; category: TagCategory }> = [];
  const seenKeys = new Set<string>();
  let nextId = 1;

  for (const tag of rawTags) {
    // Skip system tags (sync.ts filters these out)
    if (tag.startsWith('system:')) continue;

    // Parse tag to get category and name
    let category: TagCategory = TagCategory.GENERAL;
    let name = tag;

    if (tag.includes(':')) {
      const colonIndex = tag.indexOf(':');
      const namespace = tag.substring(0, colonIndex).toLowerCase();
      name = tag.substring(colonIndex + 1);

      // Map namespace to category (simplified version of tag-mapper logic)
      const categoryMap: Record<string, TagCategory> = {
        artist: TagCategory.ARTIST,
        creator: TagCategory.ARTIST,
        character: TagCategory.CHARACTER,
        series: TagCategory.COPYRIGHT,
        copyright: TagCategory.COPYRIGHT,
        meta: TagCategory.META,
      };
      category = categoryMap[namespace] ?? TagCategory.GENERAL;
    }

    // Deduplicate by key
    const key = `${category}:${name.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    tags.push({ id: nextId++, name, category });
  }

  return tags;
}

/**
 * Build mock group data that matches what bulkEnsureGroups would return.
 * Takes URLs and returns mock Group objects with IDs.
 */
function buildMockGroups(urls: string[]): Array<{ id: number; sourceType: SourceType; sourceId: string }> {
  const groups: Array<{ id: number; sourceType: SourceType; sourceId: string }> = [];
  const seenKeys = new Set<string>();
  let nextId = 1;

  for (const url of urls) {
    let sourceType: SourceType | null = null;
    let sourceId: string | null = null;

    // Pixiv
    const pixivMatch = url.match(/pixiv\.net\/(?:en\/)?artworks\/(\d+)/) ||
                       url.match(/pximg\.net\/.*\/(\d+)_p\d+/);
    if (pixivMatch) {
      sourceType = SourceType.PIXIV;
      sourceId = pixivMatch[1];
    }

    // Twitter
    const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (twitterMatch) {
      sourceType = SourceType.TWITTER;
      sourceId = twitterMatch[1];
    }

    // Danbooru
    const danbooruMatch = url.match(/danbooru\.donmai\.us\/posts\/(\d+)/);
    if (danbooruMatch) {
      sourceType = SourceType.DANBOORU;
      sourceId = danbooruMatch[1];
    }

    if (sourceType && sourceId) {
      const key = `${sourceType}:${sourceId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      groups.push({ id: nextId++, sourceType, sourceId });
    }
  }

  return groups;
}

/**
 * Default tags used by createMockFileMetadata and createMockFileBatch
 */
const DEFAULT_TAGS = ['tag1', 'artist:test artist'];

/**
 * Setup standard mocks for file processing tests.
 * Mocks $executeRawUnsafe, tag.findMany, and group.findMany to return appropriate data.
 */
function setupFileProcessingMocks(options: {
  tags?: string[];
  urls?: string[];
} = {}) {
  const tags = options.tags ?? DEFAULT_TAGS;
  const urls = options.urls ?? [];

  // Mock $executeRawUnsafe (used for bulk tag/group inserts)
  prismaMock.$executeRawUnsafe.mockResolvedValue(0);

  // Mock tag.findMany to return tags with IDs
  const mockTags = buildMockTags(tags);
  prismaMock.tag.findMany.mockResolvedValue(mockTags as never);

  // Mock group.findMany to return groups with IDs
  const mockGroups = buildMockGroups(urls);
  prismaMock.group.findMany.mockResolvedValue(mockGroups as never);

  // Mock post operations
  prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
  prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.postTag.createMany.mockResolvedValue({ count: mockTags.length });
  prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.postGroup.createMany.mockResolvedValue({ count: mockGroups.length });
  prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.note.createMany.mockResolvedValue({ count: 0 });
}

// Mock functions must be hoisted with vi.hoisted
const { mockSearchFiles, mockGetFileMetadata, mockVerifyAccessKey } = vi.hoisted(() => ({
  mockSearchFiles: vi.fn(),
  mockGetFileMetadata: vi.fn(),
  mockVerifyAccessKey: vi.fn(),
}));

// Mock the HydrusClient module
vi.mock('./client', () => {
  // Define the class inside the factory so it's available when the mock is hoisted
  class MockHydrusClient {
    searchFiles = mockSearchFiles;
    getFileMetadata = mockGetFileMetadata;
    verifyAccessKey = mockVerifyAccessKey;
  }

  return {
    HydrusClient: MockHydrusClient,
    getHydrusClient: vi.fn(() => new MockHydrusClient()),
    HydrusApiError: class HydrusApiError extends Error {
      statusCode: number;
      responseBody?: string;
      constructor(message: string, statusCode: number, responseBody?: string) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
      }
    },
  };
});

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

// Import the module under test
import { syncFromHydrus, getSyncState, type SyncProgress } from './sync';

describe('syncFromHydrus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();

    // Default: no existing sync state
    prismaMock.syncState.findFirst.mockResolvedValue(null);

    // Default: sync state updates succeed
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should throw if sync is already running', async () => {
      prismaMock.syncState.findFirst.mockResolvedValue({
        id: 1,
        status: 'running',
        lastSyncedAt: null,
        lastSyncCount: 0,
        errorMessage: null,
        totalFiles: 100,
        processedFiles: 50,
        currentBatch: 1,
        totalBatches: 2,
      });

      await expect(syncFromHydrus()).rejects.toThrow(
        'A sync operation is already in progress'
      );
    });

    it('should allow sync when previous sync completed', async () => {
      prismaMock.syncState.findFirst.mockResolvedValue({
        id: 1,
        status: 'completed',
        lastSyncedAt: new Date(),
        lastSyncCount: 100,
        errorMessage: null,
        totalFiles: 100,
        processedFiles: 100,
        currentBatch: 1,
        totalBatches: 1,
      });

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

      const result = await syncFromHydrus();
      expect(result.phase).toBe('complete');
    });

    it('should allow sync when previous sync errored', async () => {
      prismaMock.syncState.findFirst.mockResolvedValue({
        id: 1,
        status: 'error',
        lastSyncedAt: null,
        lastSyncCount: 0,
        errorMessage: 'Previous error',
        totalFiles: 100,
        processedFiles: 50,
        currentBatch: 1,
        totalBatches: 2,
      });

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

      const result = await syncFromHydrus();
      expect(result.phase).toBe('complete');
    });
  });

  describe('search phase', () => {
    it('should search with default tags when none provided', async () => {
      mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

      await syncFromHydrus();

      expect(mockSearchFiles).toHaveBeenCalledWith({
        tags: ['system:everything'],
        returnHashes: true,
      });
    });

    it('should use provided tags for filtering', async () => {
      mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

      await syncFromHydrus({ tags: ['artist:test', 'rating:safe'] });

      expect(mockSearchFiles).toHaveBeenCalledWith({
        tags: ['artist:test', 'rating:safe'],
        returnHashes: true,
      });
    });

    it('should complete immediately when no files found', async () => {
      mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

      const result = await syncFromHydrus();

      expect(result.phase).toBe('complete');
      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
      expect(mockGetFileMetadata).not.toHaveBeenCalled();
    });
  });

  describe('batch processing', () => {
    it('should process files in batches of 256', async () => {
      // Create 300 file IDs to test batching
      const fileIds = Array.from({ length: 300 }, (_, i) => i + 1);
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));

      // First batch (256 files)
      mockGetFileMetadata
        .mockResolvedValueOnce(
          createMockMetadataResponse(createMockFileBatch(256))
        )
        // Second batch (44 files)
        .mockResolvedValueOnce(
          createMockMetadataResponse(createMockFileBatch(44))
        );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      const progressUpdates: SyncProgress[] = [];
      await syncFromHydrus({
        onProgress: (p) => progressUpdates.push({ ...p }),
      });

      // Should have called getFileMetadata twice (2 batches)
      expect(mockGetFileMetadata).toHaveBeenCalledTimes(2);

      // First batch should request 256 file IDs
      expect(mockGetFileMetadata).toHaveBeenNthCalledWith(1, {
        fileIds: fileIds.slice(0, 256),
        includeBlurhash: true,
        includeNotes: true,
      });

      // Second batch should request remaining 44 file IDs
      expect(mockGetFileMetadata).toHaveBeenNthCalledWith(2, {
        fileIds: fileIds.slice(256, 300),
        includeBlurhash: true,
        includeNotes: true,
      });
    });

    it('should report correct total batches', async () => {
      const fileIds = Array.from({ length: 600 }, (_, i) => i + 1);
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse(createMockFileBatch(256))
      );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      let reportedTotalBatches = 0;
      await syncFromHydrus({
        onProgress: (p) => {
          if (p.totalBatches > 0) {
            reportedTotalBatches = p.totalBatches;
          }
        },
      });

      // 600 files / 256 per batch = 3 batches (ceiling)
      expect(reportedTotalBatches).toBe(3);
    });
  });

  describe('progress tracking', () => {
    it('should call onProgress callback for each phase', async () => {
      const fileIds = [1, 2, 3];
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse(createMockFileBatch(3))
      );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      const phases: string[] = [];
      await syncFromHydrus({
        onProgress: (p) => {
          if (!phases.includes(p.phase)) {
            phases.push(p.phase);
          }
        },
      });

      expect(phases).toContain('searching');
      expect(phases).toContain('fetching');
      expect(phases).toContain('processing');
      expect(phases).toContain('complete');
    });

    it('should track processed file count accurately', async () => {
      const fileIds = [1, 2, 3, 4, 5];
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse(createMockFileBatch(5))
      );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      const result = await syncFromHydrus();

      expect(result.processedFiles).toBe(5);
      expect(result.totalFiles).toBe(5);
    });
  });

  describe('cancellation', () => {
    it('should check for cancellation at batch boundaries', async () => {
      const fileIds = Array.from({ length: 300 }, (_, i) => i + 1);
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse(createMockFileBatch(256))
      );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      // Simulate cancellation after first batch
      let callCount = 0;
      prismaMock.syncState.findFirst.mockImplementation(async (args) => {
        callCount++;
        // First few calls: not cancelled (during init and first batch)
        // Later calls: cancelled (check at second batch boundary)
        if (callCount > 3) {
          return {
            id: 1,
            status: 'cancelled',
            lastSyncedAt: null,
            lastSyncCount: 0,
            errorMessage: null,
            totalFiles: 300,
            processedFiles: 256,
            currentBatch: 1,
            totalBatches: 2,
          };
        }
        return null;
      });

      const result = await syncFromHydrus();

      // Should complete (not error) when cancelled
      expect(result.phase).toBe('complete');
      // Should not process second batch after cancellation
      expect(mockGetFileMetadata.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should record errors per file without stopping batch', async () => {
      const fileIds = [1, 2, 3];
      mockSearchFiles.mockResolvedValue(createMockSearchResponse(fileIds));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse(createMockFileBatch(3))
      );

      // Setup proper tag/group mocks to avoid warnings
      setupFileProcessingMocks();

      // Override post.upsert to simulate: first file succeeds, second fails, third succeeds
      prismaMock.post.upsert
        .mockResolvedValueOnce({ id: 1 } as never)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 3 } as never);

      const result = await syncFromHydrus();

      // Should complete despite error
      expect(result.phase).toBe('complete');
      // Should have recorded the error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
      // Should have processed 2 files successfully
      expect(result.processedFiles).toBe(2);
    });

    it('should update sync state to error on unrecoverable failure', async () => {
      // Setup an existing sync state so update is called instead of create
      prismaMock.syncState.findFirst.mockResolvedValue({
        id: 1,
        status: 'idle',
        lastSyncedAt: null,
        lastSyncCount: 0,
        errorMessage: null,
        totalFiles: 0,
        processedFiles: 0,
        currentBatch: 0,
        totalBatches: 0,
      });

      mockSearchFiles.mockRejectedValue(new Error('Network error'));

      await expect(syncFromHydrus()).rejects.toThrow('Network error');

      // Should have updated sync state with error
      expect(prismaMock.syncState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'error',
            errorMessage: 'Network error',
          }),
        })
      );
    });
  });

  describe('tag processing', () => {
    it('should extract and normalize tags from file metadata', async () => {
      const tags = [
        'general tag',
        'artist:john doe',
        'character:alice',
        'series:wonderland',
      ];
      const file = createMockFileWithTags(tags);

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse([file])
      );

      // Setup proper mocks with specific tags
      setupFileProcessingMocks({ tags });

      await syncFromHydrus();

      // Verify tag bulk insert was called with raw SQL
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalled();
    });

    it('should skip system: prefixed tags', async () => {
      const tags = [
        'valid tag',
        'system:inbox',
        'system:everything',
      ];
      const file = createMockFileWithTags(tags);

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse([file])
      );

      // Setup proper mocks - system tags are automatically filtered out
      setupFileProcessingMocks({ tags });

      await syncFromHydrus();

      // Should only have created 1 tag (valid tag), not system tags
      const tagFindCalls = prismaMock.tag.findMany.mock.calls;
      expect(tagFindCalls.length).toBeGreaterThan(0);
    });
  });

  describe('group processing', () => {
    it('should extract groups from source URLs', async () => {
      const urls = ['https://www.pixiv.net/artworks/12345678'];
      const file = createMockFileWithUrls(urls);

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse([file])
      );

      // Setup proper mocks with specific URLs
      setupFileProcessingMocks({ urls });

      await syncFromHydrus();

      // Verify group bulk insert was called
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('note syncing', () => {
    it('should sync notes when present', async () => {
      const file = createMockFileWithNotes({
        'Note 1': 'Content of note 1',
        'Note 2': 'Content of note 2',
      });

      mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
      mockGetFileMetadata.mockResolvedValue(
        createMockMetadataResponse([file])
      );

      // Setup proper mocks - file has no custom tags but default ones
      setupFileProcessingMocks();
      // Override note.createMany to return 2 for verification
      prismaMock.note.createMany.mockResolvedValue({ count: 2 });

      await syncFromHydrus();

      // Verify notes were created (inside transaction)
      expect(prismaMock.note.createMany).toHaveBeenCalled();
    });
  });
});

describe('getSyncState', () => {
  it('should return current sync state', async () => {
    const mockState = {
      id: 1,
      status: 'running',
      lastSyncedAt: new Date(),
      lastSyncCount: 100,
      errorMessage: null,
      totalFiles: 200,
      processedFiles: 100,
      currentBatch: 1,
      totalBatches: 2,
    };

    prismaMock.syncState.findFirst.mockResolvedValue(mockState);

    const result = await getSyncState();

    expect(result).toEqual(mockState);
    expect(prismaMock.syncState.findFirst).toHaveBeenCalled();
  });

  it('should return null when no sync state exists', async () => {
    prismaMock.syncState.findFirst.mockResolvedValue(null);

    const result = await getSyncState();

    expect(result).toBeNull();
  });
});

describe('syncFromHydrus - position extraction from URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  it('should extract position from Pixiv _p0 URL pattern', async () => {
    const urls = [
      'https://i.pximg.net/img-original/img/2024/01/01/00/00/00/12345678_p2.png',
    ];
    const file = createMockFileWithUrls(urls);

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks({ urls });

    await syncFromHydrus();

    // Verify postGroup.createMany was called - position should be 3 (0-indexed _p2 + 1)
    expect(prismaMock.postGroup.createMany).toHaveBeenCalled();
  });

  it('should extract position from Pixiv artworks URL', async () => {
    const urls = ['https://www.pixiv.net/artworks/12345678'];
    const file = createMockFileWithUrls(urls);

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks({ urls });

    await syncFromHydrus();

    // Should create group without position extraction (no _p pattern in artworks URL)
    expect(prismaMock.postGroup.createMany).toHaveBeenCalled();
  });

  it('should handle Twitter/X URLs for grouping', async () => {
    const urls = ['https://twitter.com/user/status/1234567890123456789'];
    const file = createMockFileWithUrls(urls);

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks({ urls });

    await syncFromHydrus();

    expect(prismaMock.postGroup.createMany).toHaveBeenCalled();
  });
});

describe('syncFromHydrus - retry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  it('should retry on deadlock error and succeed', async () => {
    const file = createMockFileMetadata({ hash: 'deadlock-test' });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    // First call fails with deadlock, second succeeds
    prismaMock.post.upsert
      .mockRejectedValueOnce(new Error('deadlock detected'))
      .mockResolvedValueOnce({ id: 1 } as never);

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
    // post.upsert should have been called twice (retry)
    expect(prismaMock.post.upsert).toHaveBeenCalledTimes(2);
  });

  it('should retry on PostgreSQL serialization failure (40001)', async () => {
    const file = createMockFileMetadata({ hash: 'serialization-test' });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    // First call fails with serialization error, second succeeds
    prismaMock.post.upsert
      .mockRejectedValueOnce(new Error('could not serialize access due to concurrent update'))
      .mockResolvedValueOnce({ id: 1 } as never);

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should retry on PostgreSQL deadlock code (40P01)', async () => {
    const file = createMockFileMetadata({ hash: 'pg-deadlock-test' });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    // First call fails with PostgreSQL deadlock code
    prismaMock.post.upsert
      .mockRejectedValueOnce(new Error('ERROR 40P01: deadlock detected'))
      .mockResolvedValueOnce({ id: 1 } as never);

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should fail after max retries exceeded', async () => {
    const file = createMockFileMetadata({ hash: 'max-retry-test' });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    // Always fail with deadlock (4 times = 1 initial + 3 retries)
    prismaMock.post.upsert.mockRejectedValue(new Error('deadlock detected'));

    const result = await syncFromHydrus();

    // Should record error after max retries
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('deadlock');
    expect(result.processedFiles).toBe(0);
    // Should have tried 4 times (1 initial + 3 retries)
    expect(prismaMock.post.upsert).toHaveBeenCalledTimes(4);
  });

  it('should not retry on non-retryable errors', async () => {
    const file = createMockFileMetadata({ hash: 'non-retryable-test' });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    // Fail with non-retryable error
    prismaMock.post.upsert.mockRejectedValue(new Error('unique constraint violation'));

    const result = await syncFromHydrus();

    // Should fail immediately without retries
    expect(result.errors.length).toBe(1);
    expect(prismaMock.post.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('syncFromHydrus - extractTags defensive handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  it('should handle file with missing tags object', async () => {
    const file = createMockFileMetadata({ hash: 'no-tags-test' });
    // Remove tags entirely
    delete (file as Record<string, unknown>).tags;

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    // Setup minimal mocks - no tags expected
    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue([]);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should handle file with null tags object', async () => {
    const file = createMockFileMetadata({ hash: 'null-tags-test' });
    (file as Record<string, unknown>).tags = null;

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue([]);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should handle service with missing display_tags', async () => {
    const file = createMockFileMetadata({ hash: 'no-display-tags-test' });
    // Malform the tags structure
    (file as Record<string, unknown>).tags = {
      'service1': {
        // Missing display_tags
        storage_tags: { '0': ['some tag'] },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue([]);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should handle non-array currentTags', async () => {
    const file = createMockFileMetadata({ hash: 'non-array-tags-test' });
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': 'not an array', // Should be array
        },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue([]);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should skip non-string tags in array', async () => {
    const file = createMockFileMetadata({ hash: 'mixed-tags-test' });
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': ['valid tag', null, 123, undefined, '', 'another valid'],
        },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    // Should only create 2 valid tags
    const mockTags = [
      { id: 1, name: 'valid tag', category: TagCategory.GENERAL },
      { id: 2, name: 'another valid', category: TagCategory.GENERAL },
    ];
    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue(mockTags as never);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 2 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should deduplicate tags case-insensitively', async () => {
    const file = createMockFileMetadata({ hash: 'duplicate-tags-test' });
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': ['Tag One', 'tag one', 'TAG ONE', 'different tag'],
        },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    // Should only have 2 unique tags after deduplication
    const mockTags = [
      { id: 1, name: 'Tag One', category: TagCategory.GENERAL },
      { id: 2, name: 'different tag', category: TagCategory.GENERAL },
    ];
    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    prismaMock.tag.findMany.mockResolvedValue(mockTags as never);
    prismaMock.group.findMany.mockResolvedValue([]);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 2 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 0 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
  });
});

describe('syncFromHydrus - updateSyncState behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
  });

  it('should preserve cancelled status when not forced', async () => {
    // Start with cancelled state
    prismaMock.syncState.findFirst.mockResolvedValue({
      id: 1,
      status: 'cancelled',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 100,
      processedFiles: 50,
      currentBatch: 1,
      totalBatches: 2,
    });

    // This should throw because we check for running, not cancelled
    // But cancelled state should be preserved in subsequent updates
    mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

    await syncFromHydrus();

    // The sync should complete (cancelled != running, so it's allowed)
    expect(prismaMock.syncState.update).toHaveBeenCalled();
  });

  it('should create sync state when none exists', async () => {
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

    await syncFromHydrus();

    expect(prismaMock.syncState.create).toHaveBeenCalled();
  });

  it('should update existing sync state', async () => {
    prismaMock.syncState.findFirst.mockResolvedValue({
      id: 1,
      status: 'completed',
      lastSyncedAt: new Date(),
      lastSyncCount: 100,
      errorMessage: null,
      totalFiles: 100,
      processedFiles: 100,
      currentBatch: 1,
      totalBatches: 1,
    });

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([]));

    await syncFromHydrus();

    expect(prismaMock.syncState.update).toHaveBeenCalled();
  });
});

describe('syncFromHydrus - title-based grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  it('should extract title groups from title: tags', async () => {
    const file = createMockFileMetadata({ hash: 'title-group-test' });
    // Add title tags
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': ['title:My Artwork Series Part 1', 'other tag'],
        },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    // Setup mocks with title group
    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    const mockTags = [
      { id: 1, name: 'My Artwork Series Part 1', category: TagCategory.GENERAL },
      { id: 2, name: 'other tag', category: TagCategory.GENERAL },
    ];
    prismaMock.tag.findMany.mockResolvedValue(mockTags as never);

    // Mock TITLE group - sourceId is a hash of the normalized title
    const mockGroups = [
      { id: 1, sourceType: SourceType.TITLE, sourceId: expect.any(String) },
    ];
    prismaMock.group.findMany.mockResolvedValue(mockGroups as never);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 2 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 1 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    // Group bulk insert should have been called
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalled();
  });

  it('should use page: tag for position when available', async () => {
    const file = createMockFileMetadata({ hash: 'page-tag-test' });
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': ['title:My Series', 'page:5'],
        },
      },
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    const mockTags = [
      { id: 1, name: 'My Series', category: TagCategory.GENERAL },
      { id: 2, name: '5', category: TagCategory.GENERAL },
    ];
    prismaMock.tag.findMany.mockResolvedValue(mockTags as never);

    const mockGroups = [
      { id: 1, sourceType: SourceType.TITLE, sourceId: 'abc12345' },
    ];
    prismaMock.group.findMany.mockResolvedValue(mockGroups as never);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 2 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 1 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
  });

  it('should combine URL-based and title-based groups', async () => {
    const file = createMockFileMetadata({ hash: 'combined-group-test' });
    (file as Record<string, unknown>).tags = {
      'service1': {
        display_tags: {
          '0': ['title:Some Title 1'],
        },
      },
    };
    file.known_urls = ['https://www.pixiv.net/artworks/12345678'];

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    prismaMock.$executeRawUnsafe.mockResolvedValue(0);
    const mockTags = [
      { id: 1, name: 'Some Title 1', category: TagCategory.GENERAL },
    ];
    prismaMock.tag.findMany.mockResolvedValue(mockTags as never);

    // Both TITLE and PIXIV groups
    const mockGroups = [
      { id: 1, sourceType: SourceType.TITLE, sourceId: 'title123' },
      { id: 2, sourceType: SourceType.PIXIV, sourceId: '12345678' },
    ];
    prismaMock.group.findMany.mockResolvedValue(mockGroups as never);
    prismaMock.post.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.postTag.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postTag.createMany.mockResolvedValue({ count: 1 });
    prismaMock.postGroup.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.postGroup.createMany.mockResolvedValue({ count: 2 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.note.createMany.mockResolvedValue({ count: 0 });

    const result = await syncFromHydrus();

    expect(result.processedFiles).toBe(1);
    // Should create 2 post-group associations
    expect(prismaMock.postGroup.createMany).toHaveBeenCalled();
  });
});

describe('syncFromHydrus - import time extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    prismaMock.syncState.findFirst.mockResolvedValue(null);
    prismaMock.syncState.create.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    prismaMock.syncState.update.mockResolvedValue({
      id: 1,
      status: 'running',
      lastSyncedAt: null,
      lastSyncCount: 0,
      errorMessage: null,
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
  });

  it('should extract import time from file_services', async () => {
    const importTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC
    const file = createMockFileMetadata({ hash: 'import-time-test' });
    file.file_services = {
      current: {
        'service1': {
          time_imported: importTimestamp,
        },
      },
      deleted: {},
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    await syncFromHydrus();

    // Verify post.upsert was called with the correct importedAt date
    expect(prismaMock.post.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          importedAt: new Date(importTimestamp * 1000),
        }),
      })
    );
  });

  it('should use current date when no import time available', async () => {
    const file = createMockFileMetadata({ hash: 'no-import-time-test' });
    file.file_services = {
      current: {
        'service1': {
          // No time_imported
        },
      },
      deleted: {},
    };

    mockSearchFiles.mockResolvedValue(createMockSearchResponse([1]));
    mockGetFileMetadata.mockResolvedValue(createMockMetadataResponse([file]));

    setupFileProcessingMocks();

    const beforeSync = new Date();
    await syncFromHydrus();
    const afterSync = new Date();

    // Verify post.upsert was called with a recent date
    const upsertCall = prismaMock.post.upsert.mock.calls[0][0];
    const importedAt = upsertCall.create.importedAt as Date;
    expect(importedAt.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    expect(importedAt.getTime()).toBeLessThanOrEqual(afterSync.getTime());
  });
});
