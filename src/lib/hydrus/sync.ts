import { prisma } from "@/lib/db";
import { join } from "path";
import { HydrusClient } from "./client";
import type { HydrusFileMetadata } from "./types";
import { parseTag, normalizeTagForStorage } from "./tag-mapper";
import { parseSourceUrls } from "./url-parser";
import { TagCategory, SourceType, Prisma } from "@/generated/prisma/client";

/**
 * Build file path from hash using Hydrus folder structure:
 * f[first two chars of hash]/[hash].[ext]
 */
function buildFilePath(hash: string, extension: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return join(basePath, `f${prefix}`, `${hash}${extension}`);
}

/**
 * Build thumbnail path from hash using Hydrus folder structure:
 * t[first two chars of hash]/[hash].thumbnail
 */
function buildThumbnailPath(hash: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return join(basePath, `t${prefix}`, `${hash}.thumbnail`);
}

const BATCH_SIZE = 256; // Hydrus recommends batches of 256 for metadata
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
  phase: "searching" | "fetching" | "processing" | "complete" | "error";
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  totalBatches: number;
  errors: string[];
}

export interface SyncOptions {
  tags?: string[]; // Filter by specific tags, defaults to system:everything
  onProgress?: (progress: SyncProgress) => void;
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
 * Returns a Map of "SOURCETYPE:sourceId" -> { sourceType, sourceId }
 */
function collectGroupsFromBatch(files: HydrusFileMetadata[]): Map<string, { sourceType: SourceType; sourceId: string }> {
  const allGroups = new Map<string, { sourceType: SourceType; sourceId: string }>();

  for (const file of files) {
    const sources = parseSourceUrls(file.known_urls || []);
    for (const source of sources) {
      const key = `${source.sourceType}:${source.sourceId}`;
      if (!allGroups.has(key)) {
        allGroups.set(key, { sourceType: source.sourceType as SourceType, sourceId: source.sourceId });
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
    console.error(`Failed to resolve ${missing.length} tags:`, missing.slice(0, 5));
  }

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
    console.error(`Failed to resolve ${missing.length} groups:`, missing.slice(0, 5));
  }

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
        console.error(errorMsg);
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
  const filePath = buildFilePath(metadata.hash, metadata.ext);
  const thumbnailPath = buildThumbnailPath(metadata.hash);

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
    console.warn(`[${metadata.hash}] Missing ${missingTags.length} tag IDs from lookup:`, missingTags.slice(0, 5));
  }

  // Parse source URLs and lookup group IDs
  const sourceUrls = metadata.known_urls || [];
  const parsedSources = parseSourceUrls(sourceUrls);
  const groupData: { groupId: number; position: number; originalUrl: string }[] = [];
  const missingGroups: string[] = [];

  for (const source of parsedSources) {
    const key = `${source.sourceType}:${source.sourceId}`;
    const groupId = lookups.groupIds.get(key);
    if (groupId !== undefined) {
      const position = extractPositionFromUrl(source.originalUrl);
      groupData.push({ groupId, position, originalUrl: source.originalUrl });
    } else {
      missingGroups.push(key);
    }
  }

  // Log warning if any groups couldn't be resolved (shouldn't happen normally)
  if (missingGroups.length > 0) {
    console.warn(`[${metadata.hash}] Missing ${missingGroups.length} group IDs from lookup:`, missingGroups);
  }

  // Single transaction for post + relations (no tag/group creation races)
  await prisma.$transaction(async (tx) => {
    // Upsert post
    const post = await tx.post.upsert({
      where: { hash: metadata.hash },
      create: {
        hydrusFileId: metadata.file_id,
        hash: metadata.hash,
        filePath,
        thumbnailPath,
        mimeType: metadata.mime,
        extension: metadata.ext,
        fileSize: metadata.size,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        hasAudio: metadata.has_audio,
        blurhash: metadata.blurhash,
        sourceUrls,
        importedAt,
      },
      update: {
        filePath,
        thumbnailPath,
        mimeType: metadata.mime,
        extension: metadata.ext,
        fileSize: metadata.size,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        hasAudio: metadata.has_audio,
        blurhash: metadata.blurhash,
        sourceUrls,
        syncedAt: new Date(),
      },
    });

    // Clear and re-add tags
    await tx.postTag.deleteMany({ where: { postId: post.id } });
    if (tagIds.length > 0) {
      await tx.postTag.createMany({
        data: tagIds.map((tagId) => ({ postId: post.id, tagId })),
        skipDuplicates: true,
      });
    }

    // Clear and re-add groups
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

    // Sync notes
    await tx.note.deleteMany({ where: { postId: post.id } });
    const notes = metadata.notes || {};
    const noteEntries = Object.entries(notes);
    if (noteEntries.length > 0) {
      await tx.note.createMany({
        data: noteEntries.map(([name, content]) => ({
          postId: post.id,
          name,
          content,
        })),
      });
    }
  }, {
    timeout: 60000, // 60s for files with many tags/groups
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

/**
 * Sync files from Hydrus to the local database
 */
export async function syncFromHydrus(options: SyncOptions = {}): Promise<SyncProgress> {
  const client = new HydrusClient();
  const progress: SyncProgress = {
    phase: "searching",
    totalFiles: 0,
    processedFiles: 0,
    currentBatch: 0,
    totalBatches: 0,
    errors: [],
  };

  const onProgress = options.onProgress || (() => {});

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

    const searchTags = options.tags || ["system:everything"];
    const searchResult = await client.searchFiles({
      tags: searchTags,
      returnHashes: true,
    });

    const fileIds = searchResult.file_ids;
    progress.totalFiles = fileIds.length;
    progress.totalBatches = Math.ceil(fileIds.length / BATCH_SIZE);
    onProgress(progress);

    // Update with total count
    await updateSyncState({ status: "running", totalFiles: progress.totalFiles, totalBatches: progress.totalBatches });

    if (fileIds.length === 0) {
      progress.phase = "complete";
      await updateSyncState({ status: "completed", count: 0 });
      onProgress(progress);
      return progress;
    }

    // Process files in batches with two-phase approach (pre-populate tags/groups, then process)
    progress.phase = "fetching";

    for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
      // Check for cancellation at start of each batch
      if (await isSyncCancelled()) {
        progress.phase = "complete";
        onProgress(progress);
        return progress;
      }

      progress.currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      onProgress(progress);

      const batchIds = fileIds.slice(i, i + BATCH_SIZE);

      try {
        // Fetch metadata for this batch
        const metadataResult = await client.getFileMetadata({
          fileIds: batchIds,
          includeBlurhash: true,
          includeNotes: true,
        });

        // Process batch with two-phase approach:
        // 1. Pre-populate all tags/groups (eliminates race conditions)
        // 2. Process files in parallel using pre-populated lookups
        await processBatchWithPrepopulation(
          metadataResult.metadata,
          progress,
          onProgress
        );

        progress.phase = "fetching";
      } catch (err) {
        const errorMsg = `Error processing batch ${progress.currentBatch}: ${err instanceof Error ? err.message : String(err)}`;
        progress.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    progress.phase = "complete";
    await updateSyncState({
      status: "completed",
      count: progress.processedFiles,
      processedFiles: progress.processedFiles,
    });
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

        // Deduplicate
        if (seenTags.has(tag.toLowerCase())) continue;
        seenTags.add(tag.toLowerCase());

        tags.push(parseTag(tag));
      }
    }
  } catch (error) {
    // Log error but return what we have so far - don't crash the entire sync
    console.error(`Error extracting tags for file ${metadata.hash}:`, error);
  }

  return tags;
}

/**
 * Extract position number from URL (e.g., _p1 from pixiv URLs)
 */
function extractPositionFromUrl(url: string): number {
  // Pixiv: 12345678_p0.png
  const pixivMatch = url.match(/_p(\d+)/);
  if (pixivMatch) {
    return parseInt(pixivMatch[1], 10);
  }

  // Twitter: media index from the URL
  const twitterMatch = url.match(/\/media\/.*?(\d+)/);
  if (twitterMatch) {
    return parseInt(twitterMatch[1], 10);
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
