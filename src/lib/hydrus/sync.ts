import { prisma } from "@/lib/db";
import { HydrusClient } from "./client";
import type { HydrusFileMetadata } from "./types";
import { parseTag, normalizeTagForStorage } from "./tag-mapper";
import { isTagBlacklisted } from "@/lib/tag-blacklist";
import { parseSourceUrls } from "./url-parser";
import { extractTitleGroups } from "./title-grouper";
import { TagCategory, SourceType, Prisma, ThumbnailStatus } from "@/generated/prisma/client";
import { invalidateAllCaches } from "@/lib/cache";
import { updateHomeStatsCache } from "@/lib/stats";
import { invalidateRecommendationsForPost } from "@/lib/recommendations";
import { syncLog } from "@/lib/logger";

export const BATCH_SIZE = 512;
const CONCURRENT_FILES = 20; // Process this many files in parallel
const MAX_RETRIES = 3; // Max retries for transient failures

/**
 * Lookup maps populated before parallel processing to avoid race conditions
 */
interface BatchLookups {
  tagIds: Map<string, number>;    // "CATEGORY:name" -> id
  groupIds: Map<string, number>;  // "SOURCETYPE:sourceId" -> id
}

export interface SyncProgress {
  phase: "searching" | "fetching" | "processing" | "cleanup" | "complete" | "error";
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  totalBatches: number;
  errors: string[];
  deletedPosts?: number;
  deletedTags?: number;
  deletedGroups?: number;
  failedBatches?: number; // Track failed batch fetches to skip cleanup
}

export interface SyncOptions {
  tags?: string[]; // Filter by specific tags, defaults to system:everything
  onProgress?: (progress: SyncProgress) => void;
  batchSize?: number; // Override batch size (for testing)
}

// =============================================================================
// BULK OPERATIONS - Eliminate race conditions via batch pre-population
// =============================================================================

/**
 * Pre-extract all unique tags from a batch of files.
 * Returns a Map of "CATEGORY:name" -> { name, category }
 */
function collectTagsFromBatch(files: HydrusFileMetadata[]): Map<string, { name: string; category: TagCategory }> {
  const allTags = new Map<string, { name: string; category: TagCategory }>();

  for (const file of files) {
    const tags = extractTags(file);
    for (const tag of tags) {
      const normalized = normalizeTagForStorage(tag);
      const key = `${normalized.category}:${normalized.name.toLowerCase()}`;
      if (!allTags.has(key)) {
        allTags.set(key, normalized);
      }
    }
  }

  return allTags;
}

/**
 * Pre-extract all unique groups from a batch of files.
 * Includes both URL-based groups and title-based groups.
 * Returns a Map of "SOURCETYPE:sourceId" -> { sourceType, sourceId }
 */
function collectGroupsFromBatch(files: HydrusFileMetadata[]): Map<string, { sourceType: SourceType; sourceId: string }> {
  const allGroups = new Map<string, { sourceType: SourceType; sourceId: string }>();

  for (const file of files) {
    // URL-based groups
    const sources = parseSourceUrls(file.known_urls || []);
    for (const source of sources) {
      const key = `${source.sourceType}:${source.sourceId}`;
      if (!allGroups.has(key)) {
        allGroups.set(key, { sourceType: source.sourceType as SourceType, sourceId: source.sourceId });
      }
    }

    // Title-based groups (from title: tags)
    const titleGroups = extractTitleGroups(file);
    for (const titleGroup of titleGroups) {
      const key = `${titleGroup.sourceType}:${titleGroup.sourceId}`;
      if (!allGroups.has(key)) {
        allGroups.set(key, { sourceType: titleGroup.sourceType, sourceId: titleGroup.sourceId });
      }
    }
  }

  return allGroups;
}

/**
 * Bulk insert tags using INSERT ... ON CONFLICT DO NOTHING.
 * Wrapped in a transaction to ensure INSERT and SELECT are atomic.
 * Returns a Map of "CATEGORY:name" -> id
 */
async function bulkEnsureTags(
  tags: Map<string, { name: string; category: TagCategory }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (tags.size === 0) return result;

  const tagArray = [...tags.values()];

  // Validate enum values before building query
  const validCategories = new Set(Object.values(TagCategory));
  const invalidTags = tagArray.filter(t => !validCategories.has(t.category));
  if (invalidTags.length > 0) {
    throw new Error(`Invalid tag categories: ${invalidTags.map(t => t.category).join(', ')}`);
  }

  // Wrap INSERT and SELECT in a transaction to prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Build values for INSERT
    const values = tagArray.map((t, i) => `($${i * 2 + 1}, $${i * 2 + 2}::"TagCategory")`).join(', ');
    const params = tagArray.flatMap(t => [t.name, t.category]);

    // Atomic bulk insert - ON CONFLICT DO NOTHING handles duplicates
    await tx.$executeRawUnsafe(
      `INSERT INTO "Tag" (name, category) VALUES ${values} ON CONFLICT (name, category) DO NOTHING`,
      ...params
    );

    // Fetch all IDs in same transaction - guaranteed to see our inserts
    const existingTags = await tx.tag.findMany({
      where: {
        OR: tagArray.map(t => ({ name: t.name, category: t.category }))
      },
      select: { id: true, name: true, category: true }
    });

    for (const tag of existingTags) {
      const key = `${tag.category}:${tag.name.toLowerCase()}`;
      result.set(key, tag.id);
    }
  }, {
    timeout: 30000, // 30s for large tag sets
  });

  // Verify all tags were resolved
  if (result.size !== tagArray.length) {
    const missing = tagArray.filter(t => !result.has(`${t.category}:${t.name.toLowerCase()}`));
    syncLog.error({ missingCount: missing.length, sample: missing.slice(0, 5) }, 'Failed to resolve tags during bulk insert');
  }

  syncLog.debug({ tagCount: tagArray.length, resolvedCount: result.size }, 'Bulk tag insert completed');

  return result;
}

/**
 * Bulk insert groups using INSERT ... ON CONFLICT DO NOTHING.
 * Wrapped in a transaction to ensure INSERT and SELECT are atomic.
 * Returns a Map of "SOURCETYPE:sourceId" -> id
 */
async function bulkEnsureGroups(
  groups: Map<string, { sourceType: SourceType; sourceId: string }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (groups.size === 0) return result;

  const groupArray = [...groups.values()];

  // Validate enum values before building query
  const validSourceTypes = new Set(Object.values(SourceType));
  const invalidGroups = groupArray.filter(g => !validSourceTypes.has(g.sourceType));
  if (invalidGroups.length > 0) {
    throw new Error(`Invalid source types: ${invalidGroups.map(g => g.sourceType).join(', ')}`);
  }

  // Wrap INSERT and SELECT in a transaction to prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Build values for INSERT
    const values = groupArray.map((g, i) => `($${i * 2 + 1}::"SourceType", $${i * 2 + 2})`).join(', ');
    const params = groupArray.flatMap(g => [g.sourceType, g.sourceId]);

    // Atomic bulk insert - ON CONFLICT DO NOTHING handles duplicates
    await tx.$executeRawUnsafe(
      `INSERT INTO "Group" ("sourceType", "sourceId") VALUES ${values} ON CONFLICT ("sourceType", "sourceId") DO NOTHING`,
      ...params
    );

    // Fetch all IDs in same transaction - guaranteed to see our inserts
    const existingGroups = await tx.group.findMany({
      where: {
        OR: groupArray.map(g => ({ sourceType: g.sourceType, sourceId: g.sourceId }))
      },
      select: { id: true, sourceType: true, sourceId: true }
    });

    for (const group of existingGroups) {
      const key = `${group.sourceType}:${group.sourceId}`;
      result.set(key, group.id);
    }
  }, {
    timeout: 30000, // 30s for large group sets
  });

  // Verify all groups were resolved
  if (result.size !== groupArray.length) {
    const missing = groupArray.filter(g => !result.has(`${g.sourceType}:${g.sourceId}`));
    syncLog.error({ missingCount: missing.length, sample: missing.slice(0, 5) }, 'Failed to resolve groups during bulk insert');
  }

  syncLog.debug({ groupCount: groupArray.length, resolvedCount: result.size }, 'Bulk group insert completed');

  return result;
}

/**
 * Process a batch of files with proper two-phase architecture:
 * 1. Pre-populate all tags and groups (eliminates race conditions)
 * 2. Process files in parallel using pre-populated lookups
 */
async function processBatchWithPrepopulation(
  files: HydrusFileMetadata[],
  progress: SyncProgress,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  // Phase 1: Collect and pre-populate all unique tags
  const uniqueTags = collectTagsFromBatch(files);
  const tagIds = await bulkEnsureTags(uniqueTags);

  // Phase 1b: Collect and pre-populate all unique groups
  const uniqueGroups = collectGroupsFromBatch(files);
  const groupIds = await bulkEnsureGroups(uniqueGroups);

  const lookups: BatchLookups = { tagIds, groupIds };

  // Phase 2: Process files in parallel (now safe - no tag/group creation races)
  progress.phase = "processing";

  for (let j = 0; j < files.length; j += CONCURRENT_FILES) {
    const chunk = files.slice(j, j + CONCURRENT_FILES);
    const results = await Promise.allSettled(
      chunk.map((file) => processFileWithLookups(file, lookups))
    );

    for (let k = 0; k < results.length; k++) {
      const result = results[k];
      if (result.status === "fulfilled") {
        progress.processedFiles++;
      } else {
        const errorMsg = `Error processing file ${chunk[k].hash}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
        progress.errors.push(errorMsg);
        syncLog.error({ hash: chunk[k].hash, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }, 'Error processing file in batch');
      }
    }

    onProgress(progress);

    // Update database progress periodically
    await updateSyncState({
      status: "running",
      processedFiles: progress.processedFiles,
      currentBatch: progress.currentBatch,
    });
  }
}

/**
 * Process a single file using pre-populated lookups (no race conditions).
 * Includes retry logic for transient failures.
 */
async function processFileWithLookups(
  metadata: HydrusFileMetadata,
  lookups: BatchLookups,
  retryCount = 0
): Promise<void> {
  try {
    await processFileSafe(metadata, lookups);
  } catch (error) {
    // Retry on transient failures (serialization failures, deadlocks)
    const isRetryable = error instanceof Error && (
      error.message.includes('deadlock') ||
      error.message.includes('could not serialize') ||
      error.message.includes('concurrent update') ||
      error.message.includes('40001') || // PostgreSQL serialization failure
      error.message.includes('40P01')    // PostgreSQL deadlock
    );

    if (isRetryable && retryCount < MAX_RETRIES) {
      // Exponential backoff: 50ms, 100ms, 200ms
      const delay = 50 * Math.pow(2, retryCount);
      syncLog.debug({ hash: metadata.hash, retryCount: retryCount + 1, delayMs: delay }, 'Retrying file processing after transient failure');
      await new Promise(resolve => setTimeout(resolve, delay));
      return processFileWithLookups(metadata, lookups, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Process a single file (safe version using pre-populated lookups).
 * All tags and groups are guaranteed to exist.
 */
async function processFileSafe(
  metadata: HydrusFileMetadata,
  lookups: BatchLookups
): Promise<void> {
  // Get import time from file services
  let importedAt = new Date();
  const fileServices = metadata.file_services.current;
  for (const service of Object.values(fileServices)) {
    if (service.time_imported) {
      importedAt = new Date(service.time_imported * 1000);
      break;
    }
  }

  // Extract and normalize tags
  const tags = extractTags(metadata);
  const normalizedTags = new Map<string, { name: string; category: TagCategory }>();
  for (const tag of tags) {
    const normalized = normalizeTagForStorage(tag);
    const key = `${normalized.category}:${normalized.name.toLowerCase()}`;
    if (!normalizedTags.has(key)) {
      normalizedTags.set(key, normalized);
    }
  }

  // Lookup tag IDs from pre-populated map (no database calls needed)
  const tagIds: number[] = [];
  const missingTags: string[] = [];
  for (const [key] of normalizedTags) {
    const tagId = lookups.tagIds.get(key);
    if (tagId !== undefined) {
      tagIds.push(tagId);
    } else {
      missingTags.push(key);
    }
  }

  // Log warning if any tags couldn't be resolved (shouldn't happen normally)
  if (missingTags.length > 0) {
    syncLog.warn({ hash: metadata.hash, missingCount: missingTags.length, sample: missingTags.slice(0, 5) }, 'Missing tag IDs from lookup');
  }

  // Parse source URLs and lookup group IDs
  const sourceUrls = metadata.known_urls || [];
  const parsedSources = parseSourceUrls(sourceUrls);
  const groupData: { groupId: number; position: number }[] = [];
  const missingGroups: string[] = [];

  for (const source of parsedSources) {
    const key = `${source.sourceType}:${source.sourceId}`;
    const groupId = lookups.groupIds.get(key);
    if (groupId !== undefined) {
      const position = extractPositionFromUrl(source.originalUrl);
      groupData.push({ groupId, position });
    } else {
      missingGroups.push(key);
    }
  }

  // Add title-based groups
  const titleGroups = extractTitleGroups(metadata);
  for (const titleGroup of titleGroups) {
    const key = `${titleGroup.sourceType}:${titleGroup.sourceId}`;
    const groupId = lookups.groupIds.get(key);
    if (groupId !== undefined) {
      groupData.push({ groupId, position: titleGroup.position });
    } else {
      missingGroups.push(key);
    }
  }

  // Log warning if any groups couldn't be resolved (shouldn't happen normally)
  if (missingGroups.length > 0) {
    syncLog.warn({ hash: metadata.hash, missingCount: missingGroups.length, groups: missingGroups }, 'Missing group IDs from lookup');
  }

  // Determine thumbnail status based on mime type
  const isMediaFile = metadata.mime.startsWith("image/") || metadata.mime.startsWith("video/");
  const thumbnailStatus = isMediaFile ? ThumbnailStatus.PENDING : ThumbnailStatus.UNSUPPORTED;

  // Single transaction for post + relations (no tag/group creation races)
  await prisma.$transaction(async (tx) => {
    // Upsert post
    const post = await tx.post.upsert({
      where: { hash: metadata.hash },
      create: {
        hydrusFileId: metadata.file_id,
        hash: metadata.hash,
        mimeType: metadata.mime,
        extension: metadata.ext,
        fileSize: metadata.size,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        hasAudio: metadata.has_audio ?? false,
        blurhash: metadata.blurhash,
        sourceUrls,
        importedAt,
        thumbnailStatus,
      },
      update: {
        mimeType: metadata.mime,
        extension: metadata.ext,
        fileSize: metadata.size,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        hasAudio: metadata.has_audio ?? false,
        blurhash: metadata.blurhash,
        sourceUrls,
        syncedAt: new Date(),
      },
    });

    // Update tags only if changed
    const existingTagIds = (await tx.postTag.findMany({
      where: { postId: post.id },
      select: { tagId: true },
    })).map(t => t.tagId);

    const sortedExistingTagIds = [...existingTagIds].sort((a, b) => a - b);
    const sortedNewTagIds = [...tagIds].sort((a, b) => a - b);
    const tagsChanged = sortedExistingTagIds.length !== sortedNewTagIds.length ||
      sortedExistingTagIds.some((id, i) => id !== sortedNewTagIds[i]);

    if (tagsChanged) {
      await tx.postTag.deleteMany({ where: { postId: post.id } });
      if (tagIds.length > 0) {
        await tx.postTag.createMany({
          data: tagIds.map((tagId) => ({ postId: post.id, tagId })),
          skipDuplicates: true,
        });
      }
      // Invalidate cached recommendations since tags changed
      await invalidateRecommendationsForPost(post.id);
    }

    // Update groups only if changed
    const existingGroups = await tx.postGroup.findMany({
      where: { postId: post.id },
      select: { groupId: true, position: true },
    });

    const groupKey = (g: { groupId: number; position: number }) => `${g.groupId}:${g.position}`;
    const existingGroupKeys = new Set(existingGroups.map(groupKey));
    const newGroupKeys = new Set(groupData.map(groupKey));
    const groupsChanged = existingGroupKeys.size !== newGroupKeys.size ||
      [...existingGroupKeys].some(k => !newGroupKeys.has(k));

    if (groupsChanged) {
      await tx.postGroup.deleteMany({ where: { postId: post.id } });
      if (groupData.length > 0) {
        await tx.postGroup.createMany({
          data: groupData.map((g) => ({
            postId: post.id,
            groupId: g.groupId,
            position: g.position,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Update notes only if changed
    const existingNotes = await tx.note.findMany({
      where: { postId: post.id },
      select: { name: true, content: true },
    });

    const notes = metadata.notes || {};
    const noteEntries = Object.entries(notes);

    const noteKey = (n: { name: string; content: string }) => `${n.name}:${n.content}`;
    const existingNoteKeys = new Set(existingNotes.map(noteKey));
    const newNoteKeys = new Set(noteEntries.map(([name, content]) => noteKey({ name, content })));
    const notesChanged = existingNoteKeys.size !== newNoteKeys.size ||
      [...existingNoteKeys].some(k => !newNoteKeys.has(k));

    if (notesChanged) {
      await tx.note.deleteMany({ where: { postId: post.id } });
      if (noteEntries.length > 0) {
        await tx.note.createMany({
          data: noteEntries.map(([name, content]) => ({
            postId: post.id,
            name,
            content,
          })),
        });
      }
    }
  }, {
    timeout: 60000, // 60s for files with many tags/groups
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

const DELETION_BATCH_SIZE = 1000;

/**
 * Delete posts that no longer exist in Hydrus.
 * Compares Hydrus search results with database posts.
 * Returns the count of deleted posts.
 */
async function deleteRemovedPosts(hydrusHashes: Set<string>): Promise<number> {
  // Get all post hashes from database
  const dbPosts = await prisma.post.findMany({
    select: { hash: true },
  });

  // Find posts that exist in DB but not in Hydrus
  const hashesToDelete = dbPosts
    .filter(post => !hydrusHashes.has(post.hash))
    .map(post => post.hash);

  if (hashesToDelete.length === 0) {
    return 0;
  }

  // Delete in batches to avoid query size limits
  let totalDeleted = 0;
  for (let i = 0; i < hashesToDelete.length; i += DELETION_BATCH_SIZE) {
    const batch = hashesToDelete.slice(i, i + DELETION_BATCH_SIZE);
    const result = await prisma.post.deleteMany({
      where: { hash: { in: batch } },
    });
    totalDeleted += result.count;
  }

  syncLog.info({ deletedCount: totalDeleted }, 'Deleted posts removed from Hydrus');
  return totalDeleted;
}

/**
 * Delete tags that have no associated posts.
 * Should be called after post deletion.
 */
async function deleteOrphanedTags(): Promise<number> {
  const result = await prisma.tag.deleteMany({
    where: {
      posts: {
        none: {},
      },
    },
  });

  if (result.count > 0) {
    syncLog.info({ deletedCount: result.count }, 'Deleted orphaned tags');
  }
  return result.count;
}

/**
 * Delete groups that have no associated posts.
 */
async function deleteOrphanedGroups(): Promise<number> {
  const result = await prisma.group.deleteMany({
    where: {
      posts: {
        none: {},
      },
    },
  });

  if (result.count > 0) {
    syncLog.info({ deletedCount: result.count }, 'Deleted orphaned groups');
  }
  return result.count;
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

/**
 * Sync files from Hydrus to the local database
 */
export async function syncFromHydrus(options: SyncOptions = {}): Promise<SyncProgress> {
  const client = new HydrusClient();
  const startTime = Date.now();
  const progress: SyncProgress = {
    phase: "searching",
    totalFiles: 0,
    processedFiles: 0,
    currentBatch: 0,
    totalBatches: 0,
    errors: [],
  };

  const onProgress = options.onProgress || (() => {});
  const searchTags = options.tags || ["system:everything"];
  const batchSize = options.batchSize ?? BATCH_SIZE;

  syncLog.info({ tags: searchTags }, 'Starting sync from Hydrus');

  try {
    // Prevent concurrent sync operations - check if one is already running
    const existingState = await prisma.syncState.findFirst();
    if (existingState?.status === "running") {
      throw new Error("A sync operation is already in progress. Please wait for it to complete or cancel it first.");
    }

    // Update sync state to running (force to clear any previous cancelled state)
    await updateSyncState({ status: "running", totalFiles: 0, processedFiles: 0, currentBatch: 0, totalBatches: 0, force: true });

    // Search for files
    progress.phase = "searching";
    onProgress(progress);

    const searchResult = await client.searchFiles({
      tags: searchTags,
      returnHashes: true,
    });

    const fileIds = searchResult.file_ids;
    const hydrusHashes = new Set(searchResult.hashes || []);
    progress.totalFiles = fileIds.length;
    progress.totalBatches = Math.ceil(fileIds.length / batchSize);
    syncLog.info({ totalFiles: fileIds.length, batches: progress.totalBatches }, 'Search complete, starting batch processing');
    onProgress(progress);

    // Update with total count
    await updateSyncState({ status: "running", totalFiles: progress.totalFiles, totalBatches: progress.totalBatches });

    // Process files in batches with pipelined fetching:
    // Fetch batch N+1 while processing batch N to overlap network I/O with processing
    progress.phase = "fetching";

    if (fileIds.length > 0) {
      // Start fetching first batch
      // Attach .catch() to prevent unhandled rejection if it fails before we await it
      const firstBatchIds = fileIds.slice(0, batchSize);
      const firstFetchPromise = client.getFileMetadata({
        fileIds: firstBatchIds,
        includeBlurhash: true,
        includeNotes: true,
      });
      firstFetchPromise.catch(() => {});
      let currentFetchPromise: Promise<{ metadata: HydrusFileMetadata[] }> = firstFetchPromise;

      for (let i = 0; i < fileIds.length; i += batchSize) {
        // Check for cancellation at start of each batch
        if (await isSyncCancelled()) {
          progress.phase = "complete";
          onProgress(progress);
          return progress;
        }

        progress.currentBatch = Math.floor(i / batchSize) + 1;
        onProgress(progress);

        const currentBatchSize = Math.min(batchSize, fileIds.length - i);
        syncLog.debug({ batch: progress.currentBatch, batchSize: currentBatchSize }, 'Processing batch');

        try {
          // Wait for current batch metadata (was started in previous iteration or before loop)
          const metadataResult = await currentFetchPromise;

          // Start fetching next batch while we process current (pipelining)
          // Attach .catch() to prevent unhandled rejection if processing fails
          const nextBatchStart = i + batchSize;
          if (nextBatchStart < fileIds.length) {
            const nextBatchIds = fileIds.slice(nextBatchStart, nextBatchStart + batchSize);
            const fetchPromise = client.getFileMetadata({
              fileIds: nextBatchIds,
              includeBlurhash: true,
              includeNotes: true,
            });
            fetchPromise.catch(() => {});
            currentFetchPromise = fetchPromise;
          }

          // Process current batch (next batch is fetching in parallel)
          await processBatchWithPrepopulation(
            metadataResult.metadata,
            progress,
            onProgress
          );

          progress.phase = "fetching";
        } catch (err) {
          const errorMsg = `Error processing batch ${progress.currentBatch}: ${err instanceof Error ? err.message : String(err)}`;
          progress.errors.push(errorMsg);
          progress.failedBatches = (progress.failedBatches ?? 0) + 1;
          syncLog.error({ batch: progress.currentBatch, error: err instanceof Error ? err.message : String(err) }, 'Error processing batch');

          // If fetch failed, start fetching the next batch anyway
          // Attach no-op .catch() to prevent unhandled rejection if loop ends before we await it
          const nextBatchStart = i + batchSize;
          if (nextBatchStart < fileIds.length) {
            const nextBatchIds = fileIds.slice(nextBatchStart, nextBatchStart + batchSize);
            const fetchPromise = client.getFileMetadata({
              fileIds: nextBatchIds,
              includeBlurhash: true,
              includeNotes: true,
            });
            // Absorb rejection if never awaited; error will be caught when awaited in next iteration
            fetchPromise.catch(() => {});
            currentFetchPromise = fetchPromise;
          }
        }
      }

      // Ensure any pending fetch promise is awaited to prevent unhandled rejections
      // This can happen if the last iteration started a prefetch that we never awaited
      try {
        await currentFetchPromise;
      } catch {
        // Absorb error - already handled via failedBatches counter
      }
    }

    // Check for cancellation before cleanup
    if (await isSyncCancelled()) {
      progress.phase = "complete";
      onProgress(progress);
      return progress;
    }

    // Cleanup phase: only run for full syncs with no batch failures
    // If any batches failed to fetch, we can't safely determine what was deleted from Hydrus
    const isFullSync = searchTags.length === 1 && searchTags[0] === "system:everything";
    const hasFailedBatches = (progress.failedBatches ?? 0) > 0;

    if (isFullSync && hasFailedBatches) {
      syncLog.warn({ failedBatches: progress.failedBatches }, 'Skipping cleanup due to failed batch fetches');
    }

    if (isFullSync && !hasFailedBatches) {
      progress.phase = "cleanup";
      onProgress(progress);

      try {
        if (!(await isSyncCancelled())) {
          progress.deletedPosts = await deleteRemovedPosts(hydrusHashes);
        }
        if (!(await isSyncCancelled())) {
          progress.deletedTags = await deleteOrphanedTags();
        }
        if (!(await isSyncCancelled())) {
          progress.deletedGroups = await deleteOrphanedGroups();
        }
      } catch (err) {
        const errorMsg = `Cleanup error: ${err instanceof Error ? err.message : String(err)}`;
        progress.errors.push(errorMsg);
        syncLog.error({ error: err instanceof Error ? err.message : String(err) }, 'Error during cleanup phase');
        // Continue with sync completion even if cleanup fails
      }
    }

    progress.phase = "complete";

    await updateTotalPostCount();
    // Recalculate tag post counts for efficient sorting
    await recalculateTagCounts();
    // Update precomputed homepage stats
    await updateHomeStatsCache();

    invalidateAllCaches();
    await updateSyncState({
      status: "completed",
      count: progress.processedFiles,
      processedFiles: progress.processedFiles,
    });

    const durationMs = Date.now() - startTime;
    syncLog.info({
      processedFiles: progress.processedFiles,
      deletedPosts: progress.deletedPosts ?? 0,
      deletedTags: progress.deletedTags ?? 0,
      deletedGroups: progress.deletedGroups ?? 0,
      errors: progress.errors.length,
      durationMs,
    }, 'Sync completed');
    onProgress(progress);

    return progress;
  } catch (err) {
    progress.phase = "error";
    const errorMsg = err instanceof Error ? err.message : String(err);
    progress.errors.push(errorMsg);
    await updateSyncState({
      status: "error",
      count: progress.processedFiles,
      errorMessage: errorMsg,
      processedFiles: progress.processedFiles,
    });
    onProgress(progress);
    throw err;
  }
}

/**
 * Extract tags from Hydrus metadata.
 * Defensively handles missing or malformed data.
 */
function extractTags(metadata: HydrusFileMetadata): ReturnType<typeof parseTag>[] {
  const tags: ReturnType<typeof parseTag>[] = [];
  const seenTags = new Set<string>();

  // Guard against missing tags object
  if (!metadata.tags || typeof metadata.tags !== 'object') {
    return tags;
  }

  try {
    // Use "all known tags" service or iterate all services
    for (const [, serviceTags] of Object.entries(metadata.tags)) {
      // Guard against missing service tags
      if (!serviceTags || typeof serviceTags !== 'object') continue;

      // Use display tags (after sibling/parent processing)
      const displayTags = serviceTags.display_tags;

      // Guard against missing display_tags
      if (!displayTags || typeof displayTags !== 'object') continue;

      // Status "0" is current tags
      const currentTags = displayTags["0"];

      // Guard against missing or invalid current tags
      if (!Array.isArray(currentTags)) continue;

      for (const tag of currentTags) {
        // Guard against non-string tags
        if (typeof tag !== 'string' || !tag) continue;

        // Skip system tags
        if (tag.startsWith("system:")) continue;

        // Skip blacklisted tags
        if (isTagBlacklisted(tag)) continue;

        // Deduplicate
        if (seenTags.has(tag.toLowerCase())) continue;
        seenTags.add(tag.toLowerCase());

        tags.push(parseTag(tag));
      }
    }
  } catch (error) {
    // Log error but return what we have so far - don't crash the entire sync
    syncLog.error({ hash: metadata.hash, error: error instanceof Error ? error.message : String(error) }, 'Error extracting tags from file metadata');
  }

  return tags;
}

/**
 * Extract position number from URL (e.g., _p0 from pixiv URLs)
 * Returns 1-indexed position for consistency with title-based grouping
 */
function extractPositionFromUrl(url: string): number {
  // Pixiv: 12345678_p0.png (0-indexed in URL, convert to 1-indexed)
  const pixivMatch = url.match(/_p(\d+)/);
  if (pixivMatch) {
    return parseInt(pixivMatch[1], 10) + 1;
  }

  // Twitter: media index from the URL (0-indexed, convert to 1-indexed)
  const twitterMatch = url.match(/\/media\/.*?(\d+)/);
  if (twitterMatch) {
    return parseInt(twitterMatch[1], 10) + 1;
  }

  return 0;
}

interface SyncStateUpdate {
  status: string;
  count?: number;
  errorMessage?: string;
  totalFiles?: number;
  processedFiles?: number;
  currentBatch?: number;
  totalBatches?: number;
  force?: boolean; // Force status update, bypassing cancellation preservation
}

/**
 * Update the sync state in the database.
 */
async function updateSyncState(update: SyncStateUpdate): Promise<void> {
  const existingState = await prisma.syncState.findFirst();

  // Don't overwrite "cancelled" status with "running" - preserve cancellation (unless forced)
  const preserveCancel = !update.force && existingState?.status === "cancelled" && update.status === "running";
  const status = preserveCancel ? "cancelled" : update.status;

  const data = {
    status,
    lastSyncedAt: update.status === "completed" ? new Date() : existingState?.lastSyncedAt,
    lastSyncCount: update.count ?? existingState?.lastSyncCount ?? 0,
    errorMessage: update.errorMessage ?? null,
    totalFiles: update.totalFiles ?? existingState?.totalFiles ?? 0,
    processedFiles: update.processedFiles ?? existingState?.processedFiles ?? 0,
    currentBatch: update.currentBatch ?? existingState?.currentBatch ?? 0,
    totalBatches: update.totalBatches ?? existingState?.totalBatches ?? 0,
  };

  if (existingState) {
    await prisma.syncState.update({
      where: { id: existingState.id },
      data,
    });
  } else {
    await prisma.syncState.create({ data });
  }
}

/**
 * Get current sync state
 */
export async function getSyncState() {
  return prisma.syncState.findFirst();
}

/**
 * Check if sync has been cancelled
 */
async function isSyncCancelled(): Promise<boolean> {
  const state = await prisma.syncState.findFirst({ select: { status: true } });
  return state?.status === "cancelled";
}

/**
 * Recalculate postCount and idfWeight for all tags.
 * Called after sync to ensure counts are accurate for efficient sorting
 * and IDF weights are fresh for recommendation computation.
 */
async function recalculateTagCounts(): Promise<void> {
  // First update postCount
  await prisma.$executeRaw`
    UPDATE "Tag" t SET "postCount" = (
      SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
    )
  `;

  // Then compute IDF weights based on updated counts
  const totalPosts = await prisma.post.count();
  if (totalPosts > 0) {
    await prisma.$executeRaw`
      UPDATE "Tag" SET "idfWeight" = GREATEST(0, LN(${totalPosts}::FLOAT / GREATEST(1, "postCount")))
      WHERE "postCount" > 0
    `;
    // Reset idfWeight to 0 for tags with no posts
    await prisma.$executeRaw`
      UPDATE "Tag" SET "idfWeight" = 0 WHERE "postCount" = 0
    `;
  }
}

/**
 * Update the total post count stored in Settings.
 * Used for efficient excludeCount calculation in tag search.
 */
async function updateTotalPostCount(): Promise<void> {
  const count = await prisma.post.count();
  await prisma.settings.upsert({
    where: { key: "stats.totalPostCount" },
    update: { value: count.toString() },
    create: { key: "stats.totalPostCount", value: count.toString() },
  });
}
