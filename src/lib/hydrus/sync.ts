import { prisma } from "@/lib/db";
import { HydrusClient } from "./client";
import type { HydrusFileMetadata, HydrusSearchResponse } from "./types";
import { parseTag, normalizeTagForStorage } from "./tag-mapper";
import { parseSourceUrls } from "./url-parser";
import { extractTitleGroups } from "./title-grouper";
import { TagCategory, SourceType, Prisma, ThumbnailStatus } from "@/generated/prisma/client";
import { invalidateAllCaches } from "@/lib/cache";
import { updateHomeStatsCache } from "@/lib/stats";
import { invalidateAllRecommendations, invalidateRecommendationsForPost } from "@/lib/recommendations";
import { syncLog } from "@/lib/logger";
import { withSpan, addSpanEvent } from "@/lib/tracing";
import { computePhash, PHASH_SUPPORTED_MIMES } from "@/lib/phash";
import { buildFilePath } from "@/lib/hydrus/paths";
import { IncompleteLookupError, assertLookupComplete } from "./lookup-validation";

export const BATCH_SIZE = 512;
const CONCURRENT_FILES = 20; // Process this many files in parallel
const MAX_RETRIES = 3; // Max retries for transient failures

// How many errors to keep on SyncProgress before collapsing the rest into a
// single summary entry. Keeps a pathological sync (every file failing) from
// accumulating an unbounded error array.
const MAX_TRACKED_ERRORS = 200;
// Minimum interval between SyncState progress writes (crash-recovery/UI
// polling state); the in-process onProgress callback still fires per chunk.
const PROGRESS_WRITE_INTERVAL_MS = 1000;

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
  // Set when the caller has already atomically acquired the sync lock (e.g. the
  // admin API route decided the 409 via acquireSyncLock). Skips re-acquisition
  // so the caller's lock is not mistaken for a concurrent sync.
  lockAlreadyHeld?: boolean;
}

// =============================================================================
// BULK OPERATIONS - Eliminate race conditions via batch pre-population
// =============================================================================

/** Pre-resolved references for one file: normalized tag keys + group refs. */
interface ParsedFileRefs {
  tagKeys: string[]; // deduped "CATEGORY:name" keys, in extraction order
  groupRefs: { key: string; position: number }[]; // "SOURCETYPE:sourceId" keys
}

interface BatchParseResult {
  uniqueTags: Map<string, { name: string; category: TagCategory }>;
  uniqueGroups: Map<string, GroupData>;
  fileRefs: ParsedFileRefs[]; // parallel to the input files array
}

/**
 * Parse every file in the batch exactly once: extract + normalize tags and
 * groups, dedupe them into the batch-wide unique maps used for bulk
 * pre-population, and record per-file key lists so the per-file processing
 * phase never has to re-parse metadata.
 */
function parseBatch(files: HydrusFileMetadata[]): BatchParseResult {
  const uniqueTags = new Map<string, { name: string; category: TagCategory }>();
  const uniqueGroups = new Map<string, GroupData>();
  const fileRefs: ParsedFileRefs[] = new Array(files.length);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Tags: dedupe per file by normalized key (insertion order preserved)
    const tagKeys: string[] = [];
    const seenKeys = new Set<string>();
    for (const tag of extractTags(file)) {
      const normalized = normalizeTagForStorage(tag);
      const key = `${normalized.category}:${normalized.name.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      tagKeys.push(key);
      if (!uniqueTags.has(key)) {
        uniqueTags.set(key, normalized);
      }
    }

    const groupRefs: { key: string; position: number }[] = [];

    // URL-based groups
    for (const source of parseSourceUrls(file.known_urls || [])) {
      const key = `${source.sourceType}:${source.sourceId}`;
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, { sourceType: source.sourceType as SourceType, sourceId: source.sourceId });
      }
      groupRefs.push({ key, position: extractPositionFromUrl(source.originalUrl) });
    }

    // Title-based groups (from title: tags)
    for (const titleGroup of extractTitleGroups(file)) {
      const key = `${titleGroup.sourceType}:${titleGroup.sourceId}`;
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, {
          sourceType: titleGroup.sourceType,
          sourceId: titleGroup.sourceId,
          title: titleGroup.normalizedTitle,
        });
      }
      groupRefs.push({ key, position: titleGroup.position });
    }

    fileRefs[i] = { tagKeys, groupRefs };
  }

  return { uniqueTags, uniqueGroups, fileRefs };
}

/** Group data collected during batch processing */
interface GroupData {
  sourceType: SourceType;
  sourceId: string;
  title?: string; // Human-readable title (for TITLE groups)
}


/**
 * Bulk insert tags using INSERT ... ON CONFLICT DO NOTHING.
 * Wrapped in a transaction to ensure INSERT and SELECT are atomic.
 *
 * The whole set is bound as two PostgreSQL array parameters and expanded with
 * unnest(), so the bind count is constant regardless of size: no 65,535
 * bind-param limit, no generated placeholder SQL, no argument spreading, and
 * no Prisma OR-tree with thousands of conditions.
 *
 * Returns a Map of "CATEGORY:name" -> id
 */
export async function bulkEnsureTags(
  tags: Map<string, { name: string; category: TagCategory }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (tags.size === 0) return result;

  const names: string[] = [];
  const categories: string[] = [];
  const invalidCategories: string[] = [];
  const validCategories = new Set<string>(Object.values(TagCategory));
  for (const tag of tags.values()) {
    if (!validCategories.has(tag.category)) {
      invalidCategories.push(tag.category);
      continue;
    }
    names.push(tag.name);
    categories.push(tag.category);
  }
  if (invalidCategories.length > 0) {
    throw new Error(`Invalid tag categories: ${invalidCategories.join(', ')}`);
  }

  await prisma.$transaction(async (tx) => {
    // Atomic bulk insert - ON CONFLICT DO NOTHING handles duplicates
    await tx.$executeRaw`
      INSERT INTO "Tag" (name, category)
      SELECT u.name, u.category::"TagCategory"
      FROM unnest(${names}::text[], ${categories}::text[]) AS u(name, category)
      ON CONFLICT (name, category) DO NOTHING
    `;

    // Fetch IDs in the same transaction - guaranteed to see our inserts
    const rows = await tx.$queryRaw<{ id: number; name: string; category: TagCategory }[]>`
      SELECT t.id, t.name, t.category
      FROM "Tag" t
      JOIN unnest(${names}::text[], ${categories}::text[]) AS u(name, category)
        ON t.name = u.name AND t.category = u.category::"TagCategory"
    `;

    for (const tag of rows) {
      result.set(`${tag.category}:${tag.name.toLowerCase()}`, tag.id);
    }
  }, {
    timeout: 30000, // 30s for large tag sets
  });

  syncLog.debug({ tagCount: names.length, resolvedCount: result.size }, 'Bulk tag insert completed');

  return result;
}

/**
 * Bulk insert groups using INSERT ... ON CONFLICT DO UPDATE (for title).
 * Wrapped in a transaction to ensure INSERT and SELECT are atomic.
 * Binds the whole set as array parameters (see bulkEnsureTags).
 * Returns a Map of "SOURCETYPE:sourceId" -> id
 */
export async function bulkEnsureGroups(
  groups: Map<string, GroupData>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (groups.size === 0) return result;

  const sourceTypes: string[] = [];
  const sourceIds: string[] = [];
  const titles: (string | null)[] = [];
  const invalidTypes: string[] = [];
  const validSourceTypes = new Set<string>(Object.values(SourceType));
  for (const group of groups.values()) {
    if (!validSourceTypes.has(group.sourceType)) {
      invalidTypes.push(group.sourceType);
      continue;
    }
    sourceTypes.push(group.sourceType);
    sourceIds.push(group.sourceId);
    titles.push(group.title ?? null);
  }
  if (invalidTypes.length > 0) {
    throw new Error(`Invalid source types: ${invalidTypes.join(', ')}`);
  }

  await prisma.$transaction(async (tx) => {
    // Atomic bulk insert. The conflict update only fires when it would
    // actually change the title (backfill), so unchanged groups produce no
    // dead row versions or GIN index churn on re-sync.
    await tx.$executeRaw`
      INSERT INTO "Group" ("sourceType", "sourceId", "title")
      SELECT u."sourceType"::"SourceType", u."sourceId", u.title
      FROM unnest(${sourceTypes}::text[], ${sourceIds}::text[], ${titles}::text[]) AS u("sourceType", "sourceId", title)
      ON CONFLICT ("sourceType", "sourceId") DO UPDATE
      SET "title" = EXCLUDED."title"
      WHERE EXCLUDED."title" IS NOT NULL
        AND "Group"."title" IS DISTINCT FROM EXCLUDED."title"
    `;

    // Fetch IDs in the same transaction - guaranteed to see our inserts
    const rows = await tx.$queryRaw<{ id: number; sourceType: SourceType; sourceId: string }[]>`
      SELECT g.id, g."sourceType", g."sourceId"
      FROM "Group" g
      JOIN unnest(${sourceTypes}::text[], ${sourceIds}::text[]) AS u("sourceType", "sourceId")
        ON g."sourceType" = u."sourceType"::"SourceType" AND g."sourceId" = u."sourceId"
    `;

    for (const group of rows) {
      result.set(`${group.sourceType}:${group.sourceId}`, group.id);
    }
  }, {
    timeout: 30000, // 30s for large group sets
  });

  syncLog.debug({ groupCount: sourceTypes.length, resolvedCount: result.size }, 'Bulk group insert completed');

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
  onProgress: (progress: SyncProgress) => void,
  persistProgress: (progress: SyncProgress) => Promise<void>
): Promise<void> {
  return withSpan("sync.processBatch", async (batchSpan) => {
    batchSpan.setAttributes({
      "sync.batch_number": progress.currentBatch,
      "sync.batch_file_count": files.length,
    });

    // Phase 1: Parse every file once, then pre-populate all unique tags/groups
    const { uniqueTags, uniqueGroups, fileRefs } = parseBatch(files);

    const tagIds = await withSpan("sync.bulkEnsureTags", async () => {
      return bulkEnsureTags(uniqueTags);
    }, { "sync.unique_tag_count": uniqueTags.size });

    const groupIds = await withSpan("sync.bulkEnsureGroups", async () => {
      return bulkEnsureGroups(uniqueGroups);
    }, { "sync.unique_group_count": uniqueGroups.size });

    const lookups: BatchLookups = { tagIds, groupIds };

    // One existence check for the whole batch: brand-new posts skip the
    // per-file relation diffing entirely (they have nothing to diff against).
    const existingPosts = await prisma.post.findMany({
      where: { hash: { in: files.map((f) => f.hash) } },
      select: { hash: true },
    });
    const existingHashes = new Set(existingPosts.map((p) => p.hash));

    // Validate that the bulk lookups resolved every entry. A complete lookup
    // is the norm. If something is still missing,
    // DO NOT discard the whole batch: degrade to per-file processing using the
    // partial maps. The per-file path (processFileSafe) throws per-file on any
    // missing tag/group ID, and those throws are isolated by the downstream
    // Promise.allSettled - so only the genuinely-broken files fail, while every
    // other file in the batch still succeeds.
    try {
      assertLookupComplete([...uniqueTags.values()], tagIds, (tag) => `${tag.category}:${tag.name.toLowerCase()}`, 'tag');
      assertLookupComplete([...uniqueGroups.values()], groupIds, (group) => `${group.sourceType}:${group.sourceId}`, 'group');
    } catch (error) {
      if (error instanceof IncompleteLookupError) {
        syncLog.error(
          {
            batch: progress.currentBatch,
            lookup: error.lookupName,
            missingCount: error.missingEntries.length,
            sample: error.missingEntries.slice(0, 5),
          },
          'Incomplete bulk lookup; degrading to per-file processing so only affected files fail'
        );
        batchSpan.setAttribute("sync.batch_incomplete_lookup", true);
        // Fall through: continue to the per-file path below with the partial maps.
      } else {
        throw error;
      }
    }

    // Phase 2: Process files in parallel (now safe - no tag/group creation races)
    progress.phase = "processing";

    for (let j = 0; j < files.length; j += CONCURRENT_FILES) {
      const chunk = files.slice(j, j + CONCURRENT_FILES);
      const results = await Promise.allSettled(
        chunk.map((file, k) =>
          processFileWithLookups(file, fileRefs[j + k], lookups, !existingHashes.has(file.hash))
        )
      );

      for (let k = 0; k < results.length; k++) {
        const result = results[k];
        if (result.status === "fulfilled") {
          progress.processedFiles++;
        } else {
          const errorMsg = `Error processing file ${chunk[k].hash}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
          recordSyncError(progress, errorMsg);
          syncLog.error({ hash: chunk[k].hash, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }, 'Error processing file in batch');
        }
      }

      onProgress(progress);

      // Persist progress for crash recovery / status polling (throttled)
      await persistProgress(progress);
    }

    batchSpan.setAttribute("sync.batch_processed_files", files.length);
  });
}

/**
 * Process a single file using pre-populated lookups (no race conditions).
 * Includes retry logic for transient failures.
 */
async function processFileWithLookups(
  metadata: HydrusFileMetadata,
  refs: ParsedFileRefs,
  lookups: BatchLookups,
  isNew: boolean,
  retryCount = 0
): Promise<void> {
  try {
    await processFileSafe(metadata, refs, lookups, isNew);
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
      return processFileWithLookups(metadata, refs, lookups, isNew, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Process a single file (safe version using pre-populated lookups).
 * All tags and groups were parsed once at batch level (ParsedFileRefs) and
 * are guaranteed to exist in the lookups. `isNew` (from the batch existence
 * check) selects a create-only fast path with no relation diffing.
 */
async function processFileSafe(
  metadata: HydrusFileMetadata,
  refs: ParsedFileRefs,
  lookups: BatchLookups,
  isNew: boolean
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

  // Resolve tag IDs from the pre-populated map (no database calls, no re-parse)
  const tagIds: number[] = [];
  const missingTags: string[] = [];
  for (const key of refs.tagKeys) {
    const tagId = lookups.tagIds.get(key);
    if (tagId !== undefined) {
      tagIds.push(tagId);
    } else {
      missingTags.push(key);
    }
  }

  if (missingTags.length > 0) {
    syncLog.error({ hash: metadata.hash, missingCount: missingTags.length, sample: missingTags.slice(0, 5) }, 'Missing tag IDs from lookup');
    throw new Error(`Missing ${missingTags.length} tag IDs from pre-populated lookup for ${metadata.hash}`);
  }

  // Resolve group IDs (URL-based and title-based refs, in extraction order)
  const groupData: { groupId: number; position: number }[] = [];
  const missingGroups: string[] = [];
  for (const ref of refs.groupRefs) {
    const groupId = lookups.groupIds.get(ref.key);
    if (groupId !== undefined) {
      groupData.push({ groupId, position: ref.position });
    } else {
      missingGroups.push(ref.key);
    }
  }

  if (missingGroups.length > 0) {
    syncLog.error({ hash: metadata.hash, missingCount: missingGroups.length, groups: missingGroups }, 'Missing group IDs from lookup');
    throw new Error(`Missing ${missingGroups.length} group IDs from pre-populated lookup for ${metadata.hash}`);
  }

  const sourceUrls = metadata.known_urls || [];

  // Determine thumbnail status based on mime type
  const isMediaFile = metadata.mime.startsWith("image/") || metadata.mime.startsWith("video/");
  const thumbnailStatus = isMediaFile ? ThumbnailStatus.PENDING : ThumbnailStatus.UNSUPPORTED;

  const postCreateData = {
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
  };
  const noteEntries = Object.entries(metadata.notes || {});

  // Fast path: the batch existence check says the post is new, so there are
  // no relations to diff and no cached recommendations to invalidate.
  // `create` (not upsert) makes the hint self-verifying: if an external
  // writer created the post since the check, the unique violation aborts the
  // transaction and we fall through to the diff path below.
  if (isNew) {
    try {
      await prisma.$transaction(async (tx) => {
        const post = await tx.post.create({ data: postCreateData });

        if (tagIds.length > 0) {
          await tx.postTag.createMany({
            data: tagIds.map((tagId) => ({ postId: post.id, tagId })),
            skipDuplicates: true,
          });
        }
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
        timeout: 60000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });

      await computePhashSafe(metadata);
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      syncLog.debug({ hash: metadata.hash }, "New-post hint was stale; falling back to diff path");
    }
  }

  // Single transaction for post + relations (no tag/group creation races)
  await prisma.$transaction(async (tx) => {
    // Upsert post
    const post = await tx.post.upsert({
      where: { hash: metadata.hash },
      create: postCreateData,
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
      await invalidateRecommendationsForPost(post.id, tx);
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
      // Group membership affects same-group exclusion in recommendation scoring.
      await invalidateRecommendationsForPost(post.id, tx);
    }

    // Update notes only if changed
    const existingNotes = await tx.note.findMany({
      where: { postId: post.id },
      select: { name: true, content: true },
    });

    const noteKey = (n: { name: string; content: string }) => JSON.stringify([n.name, n.content]);
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

  await computePhashSafe(metadata);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Compute and store the phash for supported image types (non-fatal). */
async function computePhashSafe(metadata: HydrusFileMetadata): Promise<void> {
  if (!PHASH_SUPPORTED_MIMES.has(metadata.mime)) {
    return;
  }

  try {
    const filePath = buildFilePath(metadata.hash, metadata.ext);
    const phash = await computePhash(filePath);
    if (phash !== null) {
      await prisma.phashEntry.upsert({
        where: { hash: metadata.hash },
        create: { hash: metadata.hash, phash },
        update: { phash, computedAt: new Date() },
      });
    }
  } catch (err) {
    syncLog.warn(
      { hash: metadata.hash, error: err instanceof Error ? err.message : String(err) },
      "Failed to compute phash during sync"
    );
  }
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

const DELETION_BATCH_SIZE = 1000;
// Page size for the keyset-paginated cleanup scan over Post.
const CLEANUP_SCAN_PAGE_SIZE = 5000;

/**
 * Delete posts that no longer exist in Hydrus.
 * Streams DB posts in keyset-paginated pages and deletes each page's stale
 * ids before fetching the next, so memory stays bounded by the page size
 * even when most of the library was removed. Deleting behind the cursor
 * cannot skip rows: the scan only moves forward by id.
 * Returns the count of deleted posts.
 */
async function deleteRemovedPosts(hydrusHashes: Set<string>): Promise<number> {
  let totalDeleted = 0;
  let cursor = 0;

  for (;;) {
    const page = await prisma.post.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      select: { id: true, hash: true },
      take: CLEANUP_SCAN_PAGE_SIZE,
    });
    if (page.length === 0) break;

    cursor = page[page.length - 1].id;
    const idsToDelete: number[] = [];
    for (const post of page) {
      if (!hydrusHashes.has(post.hash)) {
        idsToDelete.push(post.id);
      }
    }

    for (let i = 0; i < idsToDelete.length; i += DELETION_BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + DELETION_BATCH_SIZE);
      const result = await prisma.post.deleteMany({
        where: { id: { in: batch } },
      });
      totalDeleted += result.count;
    }

    if (page.length < CLEANUP_SCAN_PAGE_SIZE) break;
  }

  if (totalDeleted > 0) {
    syncLog.info({ deletedCount: totalDeleted }, 'Deleted posts removed from Hydrus');
  }
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

/**
 * Record an error on the progress object, capping the array so a pathological
 * sync (e.g. every file failing) cannot grow it without bound.
 */
function recordSyncError(progress: SyncProgress, message: string): void {
  if (progress.errors.length < MAX_TRACKED_ERRORS) {
    progress.errors.push(message);
  } else if (progress.errors.length === MAX_TRACKED_ERRORS) {
    progress.errors.push(`Further errors omitted after the first ${MAX_TRACKED_ERRORS}`);
  }
}

/**
 * Time-throttled SyncState writer for progress updates. The DB row only feeds
 * crash recovery and status polling, so ~1 write/second is plenty; the
 * in-process onProgress callback still fires for every chunk.
 */
function createProgressPersister(): (progress: SyncProgress) => Promise<void> {
  let lastWriteMs = 0;
  return async (progress: SyncProgress) => {
    const now = Date.now();
    if (now - lastWriteMs < PROGRESS_WRITE_INTERVAL_MS) return;
    lastWriteMs = now;
    await updateSyncState({
      status: "running",
      processedFiles: progress.processedFiles,
      currentBatch: progress.currentBatch,
    });
  };
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

/**
 * Sync files from Hydrus to the local database
 */
export async function syncFromHydrus(options: SyncOptions = {}): Promise<SyncProgress> {
  return withSpan("sync.fromHydrus", async (rootSpan) => {
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

    rootSpan.setAttributes({
      "sync.tags": searchTags.join(","),
      "sync.batch_size": batchSize,
    });

    syncLog.info({ tags: searchTags }, 'Starting sync from Hydrus');

    try {
    // Prevent concurrent sync operations via an ATOMIC conditional write.
    // The DB write (not a prior read) decides the winner: two concurrent calls
    // race on the same UPDATE and exactly one flips the status to "running".
    // If the caller already acquired the lock (e.g. the API route), skip
    // re-acquisition so its own lock is not mistaken for a concurrent sync.
    if (!options.lockAlreadyHeld) {
      const acquired = await acquireSyncLock();
      if (!acquired) {
        throw new Error("A sync operation is already in progress. Please wait for it to complete or cancel it first.");
      }
    }

    // Search for files
    progress.phase = "searching";
    onProgress(progress);

    // Hold only what outlives the search: the file id list (batch iteration)
    // and the hash set (cleanup diff). Drop the response object itself so the
    // raw hashes array is not retained for the whole sync on top of the Set.
    let searchResult: HydrusSearchResponse | null = await client.searchFiles({
      tags: searchTags,
      returnHashes: true,
    });

    const fileIds = searchResult.file_ids;
    const hydrusHashes = new Set(searchResult.hashes || []);
    searchResult = null;
    progress.totalFiles = fileIds.length;
    progress.totalBatches = Math.ceil(fileIds.length / batchSize);

    rootSpan.setAttributes({
      "sync.total_files": fileIds.length,
      "sync.total_batches": progress.totalBatches,
    });
    addSpanEvent("search_complete", {
      total_files: fileIds.length,
      total_batches: progress.totalBatches,
    });

    syncLog.info({ totalFiles: fileIds.length, batches: progress.totalBatches }, 'Search complete, starting batch processing');
    onProgress(progress);

    // Update with total count
    await updateSyncState({ status: "running", totalFiles: progress.totalFiles, totalBatches: progress.totalBatches });

    // Process files in batches with pipelined fetching:
    // Fetch batch N+1 while processing batch N to overlap network I/O with processing
    progress.phase = "fetching";

    const persistProgress = createProgressPersister();

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
          // Flush final counts past the write throttle; updateSyncState
          // preserves the "cancelled" status for "running" updates.
          await updateSyncState({
            status: "running",
            processedFiles: progress.processedFiles,
            currentBatch: progress.currentBatch,
          });
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
            onProgress,
            persistProgress
          );

          progress.phase = "fetching";
        } catch (err) {
          const errorMsg = `Error processing batch ${progress.currentBatch}: ${err instanceof Error ? err.message : String(err)}`;
          recordSyncError(progress, errorMsg);
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
      // Flush final counts past the write throttle (see batch-loop exit).
      await updateSyncState({
        status: "running",
        processedFiles: progress.processedFiles,
        currentBatch: progress.currentBatch,
      });
      onProgress(progress);
      return progress;
    }

    // Cleanup phase: only run for full syncs with no batch failures
    // If any batches failed to fetch, we can't safely determine what was deleted from Hydrus
    const isFullSync = searchTags.length === 1 && searchTags[0] === "system:everything";
    const hasFailedBatches = (progress.failedBatches ?? 0) > 0;

    // Guard against mass deletion: cleanup compares DB posts against the
    // resolved Hydrus hash set, but `hashes` is an OPTIONAL Hydrus field while
    // we iterate `file_ids`. If Hydrus returned file_ids without hashes, the
    // hash set is empty and cleanup would delete EVERY post. Skip cleanup in
    // that case rather than wipe the database.
    const emptyHashSet = hydrusHashes.size === 0 && fileIds.length > 0;

    if (isFullSync && hasFailedBatches) {
      syncLog.warn({ failedBatches: progress.failedBatches }, 'Skipping cleanup due to failed batch fetches');
    }

    if (isFullSync && !hasFailedBatches && emptyHashSet) {
      syncLog.warn(
        { fileIdCount: fileIds.length, hashCount: hydrusHashes.size },
        'Skipping cleanup to avoid mass deletion: Hydrus returned file_ids but no hashes, so the comparison hash set is empty'
      );
    }

    if (isFullSync && !hasFailedBatches && !emptyHashSet) {
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
        recordSyncError(progress, errorMsg);
        syncLog.error({ error: err instanceof Error ? err.message : String(err) }, 'Error during cleanup phase');
        // Continue with sync completion even if cleanup fails
      }
    }

    progress.phase = "complete";

    await updateTotalPostCount();
    // Recalculate tag post counts for efficient sorting
    await recalculateTagCounts();
    // IDF refresh can change scores globally, so drop recommendation cache.
    await invalidateAllRecommendations();
    // Update precomputed homepage stats
    await updateHomeStatsCache();

    invalidateAllCaches();
    await updateSyncState({
      status: "completed",
      count: progress.processedFiles,
      processedFiles: progress.processedFiles,
    });

    const durationMs = Date.now() - startTime;
    rootSpan.setAttributes({
      "sync.processed_files": progress.processedFiles,
      "sync.deleted_posts": progress.deletedPosts ?? 0,
      "sync.deleted_tags": progress.deletedTags ?? 0,
      "sync.deleted_groups": progress.deletedGroups ?? 0,
      "sync.error_count": progress.errors.length,
      "sync.duration_ms": durationMs,
    });
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
  });
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
 * Atomically acquire the sync lock by flipping the SyncState row to "running"
 * only if it is not already running. The decision is made by the DB write, not
 * a prior read, so concurrent callers cannot both win.
 *
 * Returns true if this caller acquired the lock (and the row now reads
 * "running"), false if a sync was already running.
 */
export async function acquireSyncLock(): Promise<boolean> {
  const runningData = {
    status: "running",
    errorMessage: null,
    totalFiles: 0,
    processedFiles: 0,
    currentBatch: 0,
    totalBatches: 0,
  };

  // Fast path: a SyncState row already exists. Atomically claim it only if it
  // is not currently running. count === 1 means we won; count === 0 means
  // either it was already running OR (rarely) no row exists yet.
  const claimed = await prisma.syncState.updateMany({
    where: { status: { not: "running" } },
    data: runningData,
  });
  if (claimed.count > 0) {
    return true;
  }

  // No row was updated. Distinguish "already running" from "no row yet".
  // (First sync ever, or after the table was cleared.)
  const existing = await prisma.syncState.findFirst({ select: { status: true } });
  if (existing) {
    // A row exists but was not claimable -> a sync is already running.
    return false;
  }

  // No row exists yet: create one in the running state. If a concurrent caller
  // created it first we may end up with the row already present; re-attempt the
  // atomic claim to keep the single-winner guarantee.
  try {
    await prisma.syncState.create({ data: runningData });
    return true;
  } catch {
    const retry = await prisma.syncState.updateMany({
      where: { status: { not: "running" } },
      data: runningData,
    });
    return retry.count > 0;
  }
}

/**
 * Check if sync has been cancelled
 */
async function isSyncCancelled(): Promise<boolean> {
  const state = await prisma.syncState.findFirst({ select: { status: true } });
  return state?.status === "cancelled";
}

/**
 * Recalculate postCount and idfWeight for all tags, then each post's
 * tag-IDF vector length (tagIdfNorm, the cosine denominator).
 * Called after sync to ensure counts are accurate for efficient sorting
 * and IDF weights + norms are fresh for recommendation computation.
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

  // Refresh each post's tag-IDF vector length. Must run after the idfWeight
  // updates above; a post with no tags gets norm 0 (it can never be a
  // tag-similarity candidate, and the cosine treats norm 0 as "stale: score
  // 0" rather than dividing by zero).
  await prisma.$executeRaw`
    UPDATE "Post" p SET "tagIdfNorm" = COALESCE(
      (
        SELECT SQRT(SUM(t."idfWeight" * t."idfWeight"))
        FROM "PostTag" pt
        JOIN "Tag" t ON t.id = pt."tagId"
        WHERE pt."postId" = p.id
      ),
      0
    )
  `;
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
