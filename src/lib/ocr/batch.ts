import pLimit from "p-limit";
import { prisma } from "@/lib/db";
import { OpenRouterApiError } from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";
import {
  finalizeScan,
  markScanFailed,
  ocrPost,
  renderPostInpaintedPage,
  translateRegions,
  type ScannablePost,
} from "./scan-post";
import { getOcrTimeoutMs } from "./config";
import type { NormalizedRegion } from "./types";

const TRANSLATE_CONCURRENCY = 3;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 10000;
const MAX_ERROR_ENTRIES = 10;
const SINGLETON_KEY = "singleton";
// A running/cancelling batch row whose updatedAt falls older than the stale
// window is treated as crashed and may be reclaimed by a fresh batch. updatedAt
// is Prisma-managed and bumped on every progress write, so a live batch stays
// comfortably fresh within this window.
const MIN_STALE_BATCH_MS = 10 * 60_000;
// A background heartbeat refreshes updatedAt on this cadence for the ENTIRE
// batch lifetime — including the post-loop translation drain, where a slow
// OpenRouter call would otherwise freeze updatedAt and let a live batch's row
// look crashed. Must stay well under MIN_STALE_BATCH_MS so acquireOcrBatchLock
// never reclaims a batch that is merely slow.
const HEARTBEAT_INTERVAL_MS = 60_000;

export interface OcrBatchOptions {
  limit?: number;
  tags?: string[];
  retryFailed?: boolean;
  targetLang?: string;
}

export interface OcrBatchResult {
  status: "completed" | "cancelled" | "error";
  total: number;
  processed: number;
  failed: number;
  errors: string[];
}

/**
 * Atomically claim the OCR batch lock (SyncState pattern: the conditional
 * write decides the winner, never a prior read).
 */
export async function acquireOcrBatchLock(): Promise<boolean> {
  const runningData = {
    status: "running",
    totalPosts: 0,
    processedPosts: 0,
    failedPosts: 0,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: null,
  };

  // Reclaim a terminal row OR a running/cancelling row gone stale (crashed
  // mid-run with no finalize). The stale window exceeds the worst-case gap
  // between progress writes, so a healthy batch never matches it.
  const staleBefore = new Date(Date.now() - Math.max(MIN_STALE_BATCH_MS, getOcrTimeoutMs() * 4));
  const claimWhere = {
    key: SINGLETON_KEY,
    OR: [
      { status: { notIn: ["running", "cancelling"] } },
      { updatedAt: { lt: staleBefore } },
    ],
  };

  const claimed = await prisma.ocrBatchState.updateMany({ where: claimWhere, data: runningData });
  if (claimed.count > 0) return true;

  const existing = await prisma.ocrBatchState.findUnique({
    where: { key: SINGLETON_KEY },
    select: { status: true },
  });
  if (existing) return false;

  try {
    // The unique `key` guarantees at most one row, so a racing create loses here.
    await prisma.ocrBatchState.create({ data: { key: SINGLETON_KEY, ...runningData } });
    return true;
  } catch {
    // Lost the create race (unique violation) or the singleton row appeared
    // between our read and write; re-run the conditional claim against it.
    const retry = await prisma.ocrBatchState.updateMany({ where: claimWhere, data: runningData });
    return retry.count > 0;
  }
}

// In-flight sidecar abort handle for the active batch (single-process, like
// the admin batch locks). Lets DELETE cancel stop the current OCR instantly.
let activeBatchAbort: AbortController | null = null;

/** Request cancellation of a running batch. True when a batch was running. */
export async function requestOcrBatchCancel(): Promise<boolean> {
  const updated = await prisma.ocrBatchState.updateMany({
    where: { key: SINGLETON_KEY, status: "running" },
    data: { status: "cancelling" },
  });
  // Abort the in-flight sidecar call for an instant stop instead of waiting
  // out the current OCR request (up to OCR_SERVICE_TIMEOUT_MS on a hung sidecar).
  if (updated.count > 0) activeBatchAbort?.abort();
  return updated.count > 0;
}

/**
 * Force the singleton batch row back to a terminal state regardless of status.
 * Escape hatch for a crashed batch stuck `running`/`cancelling` that the normal
 * cancel path (which only flips running->cancelling) cannot clear. Also aborts
 * the in-flight sidecar call when the crashed batch is somehow still in-process.
 */
export async function requestOcrBatchReset(): Promise<boolean> {
  const updated = await prisma.ocrBatchState.updateMany({
    where: { key: SINGLETON_KEY, status: { in: ["running", "cancelling"] } },
    data: {
      status: "cancelled",
      errorMessage: "Batch force-reset by admin",
      finishedAt: new Date(),
    },
  });
  if (updated.count > 0) activeBatchAbort?.abort();
  return updated.count > 0;
}

/** Posts eligible for this batch run. */
export async function selectOcrBatchPosts(options: OcrBatchOptions): Promise<ScannablePost[]> {
  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const statuses = options.retryFailed ? ["PENDING", "FAILED"] : ["PENDING"];
  const tagFilters = (options.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => ({ tags: { some: { tag: { name: tag } } } }));

  return prisma.post.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      ocrStatus: { in: statuses as ("PENDING" | "FAILED")[] },
      ...(tagFilters.length > 0 ? { AND: tagFilters } : {}),
    },
    select: { id: true, hash: true, extension: true, mimeType: true },
    orderBy: { importedAt: "desc" },
    take: limit,
  });
}

async function isCancelling(): Promise<boolean> {
  const state = await prisma.ocrBatchState.findUnique({
    where: { key: SINGLETON_KEY },
    select: { status: true },
  });
  return state?.status === "cancelling";
}

async function updateProgress(processedDelta: number, failedDelta: number): Promise<void> {
  try {
    await prisma.ocrBatchState.updateMany({
      where: { key: SINGLETON_KEY, status: { in: ["running", "cancelling"] } },
      data: {
        processedPosts: { increment: processedDelta },
        failedPosts: { increment: failedDelta },
      },
    });
  } catch (error) {
    aiLog.error(
      { error: String(error), processedDelta, failedDelta },
      "OCR batch progress update failed"
    );
  }
}

// Bump the Prisma-managed updatedAt so a legitimately slow post (serial OCR +
// page render, each up to the sidecar timeout) is never mistaken for a crashed
// batch by acquireOcrBatchLock's stale-reclaim check. increment-by-0 is a real
// UPDATE that refreshes updatedAt without changing any counter.
async function heartbeat(): Promise<void> {
  try {
    await prisma.ocrBatchState.updateMany({
      where: { key: SINGLETON_KEY, status: { in: ["running", "cancelling"] } },
      data: { processedPosts: { increment: 0 } },
    });
  } catch (error) {
    aiLog.error({ error: String(error) }, "OCR batch heartbeat failed");
  }
}

async function finalize(result: OcrBatchResult): Promise<void> {
  try {
    await prisma.ocrBatchState.updateMany({
      where: { key: SINGLETON_KEY, status: { in: ["running", "cancelling"] } },
      data: {
        status: result.status,
        errorMessage: result.errors[0] ?? null,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    aiLog.error(
      { error: String(error), status: result.status, failed: result.failed },
      "OCR batch finalize failed"
    );
  }
}

/**
 * Run the OCR batch. The caller MUST already hold the lock (acquireOcrBatchLock).
 *
 * Concurrency policy:
 * - sidecar OCR: strictly SERIAL (upstream is a single serial worker);
 * - translate+persist: p-limit(3) pool overlapping the next post's OCR.
 */
export async function runOcrBatch(options: OcrBatchOptions = {}): Promise<OcrBatchResult> {
  const result: OcrBatchResult = {
    status: "completed",
    total: 0,
    processed: 0,
    failed: 0,
    errors: [],
  };
  const pushError = (message: string): void => {
    if (result.errors.length < MAX_ERROR_ENTRIES) result.errors.push(message);
  };

  // Keep the lock fresh for as long as this process is alive — across serial
  // OCR/render AND the trailing Promise.all translation drain. Cleared in the
  // finally so only a genuine crash (dead event loop) lets the row go stale.
  const heartbeatTimer = setInterval(() => {
    void heartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const posts = await selectOcrBatchPosts(options);
    result.total = posts.length;
    await prisma.ocrBatchState
      .updateMany({
        where: { key: SINGLETON_KEY, status: { in: ["running", "cancelling"] } },
        data: { totalPosts: posts.length },
      })
      .catch((error) => {
        aiLog.error(
          { error: String(error), total: posts.length },
          "OCR batch total update failed"
        );
      });
    aiLog.info({ total: posts.length }, "OCR batch started");

    const translateLimit = pLimit(TRANSLATE_CONCURRENCY);
    const pending: Promise<void>[] = [];
    let abortError: OpenRouterApiError | null = null;
    activeBatchAbort = new AbortController();
    const batchSignal = activeBatchAbort.signal;

    for (const post of posts) {
      if (abortError) break;
      if (await isCancelling()) {
        result.status = "cancelled";
        break;
      }
      // A pooled translate task may have surfaced a 401 abort while we awaited
      // the cancellation poll above; stop before scanning the next post.
      if (abortError) break;

      // Stage 1: serial OCR.
      let regions: NormalizedRegion[];
      try {
        regions = await ocrPost(post, { signal: batchSignal });
      } catch (error) {
        if (batchSignal.aborted) {
          // Cancellation aborted the in-flight OCR call: not a post failure.
          result.status = "cancelled";
          break;
        }
        result.failed++;
        pushError(`${post.hash.slice(0, 8)}: ${error instanceof Error ? error.message : String(error)}`);
        await markScanFailed(post.id).catch(() => {});
        await updateProgress(0, 1);
        continue;
      }

      // Stage 1b: render the full-page inpaint on the serial path so every
      // sidecar call stays strictly serial. No regions means no page; a render
      // failure degrades to per-region crops, but an abort means cancellation.
      const inpaintedPage =
        regions.length > 0 ? await renderPostInpaintedPage(post, { signal: batchSignal }) : null;
      if (batchSignal.aborted) {
        result.status = "cancelled";
        break;
      }

      // Stage 2: translate + persist in the pool, overlapping the next OCR.
      pending.push(
        translateLimit(async () => {
          try {
            const { translated, targetLanguage } = await translateRegions(
              regions,
              options.targetLang
            );
            await finalizeScan(post, regions, translated, targetLanguage, inpaintedPage);
            result.processed++;
            await updateProgress(1, 0);
          } catch (error) {
            if (error instanceof OpenRouterApiError && error.statusCode === 401) {
              abortError = error;
              // Persist OCR-only so the scan work is not lost.
              await finalizeScan(
                post,
                regions,
                regions.map(() => null),
                null,
                inpaintedPage
              ).catch(() => {});
              result.processed++;
              await updateProgress(1, 0);
              return;
            }
            result.failed++;
            pushError(`${post.hash.slice(0, 8)}: ${error instanceof Error ? error.message : String(error)}`);
            // Mirror the Stage 1 handling: a persist-stage failure must leave the
            // post FAILED, not silently PENDING, so a retry pass can pick it up.
            await markScanFailed(post.id).catch(() => {});
            await updateProgress(0, 1);
          }
        })
      );
    }

    await Promise.all(pending);

    if (abortError) {
      result.status = "error";
      pushError(`Authentication failed: ${(abortError as OpenRouterApiError).message}`);
    }
  } catch (error) {
    result.status = "error";
    pushError(error instanceof Error ? error.message : String(error));
    aiLog.error({ error: String(error) }, "OCR batch failed");
  } finally {
    clearInterval(heartbeatTimer);
  }

  activeBatchAbort = null;
  await finalize(result);
  aiLog.info(
    { status: result.status, processed: result.processed, failed: result.failed },
    "OCR batch finished"
  );
  return result;
}

/** Aggregate stats + batch state for the admin UI. */
export async function getOcrAdminStatus() {
  const [pendingImages, completeImages, failedImages, totalRegions, state] = await Promise.all([
    prisma.post.count({ where: { mimeType: { startsWith: "image/" }, ocrStatus: "PENDING" } }),
    prisma.post.count({ where: { mimeType: { startsWith: "image/" }, ocrStatus: "COMPLETE" } }),
    prisma.post.count({ where: { mimeType: { startsWith: "image/" }, ocrStatus: "FAILED" } }),
    prisma.imageTextRegion.count(),
    prisma.ocrBatchState.findUnique({ where: { key: SINGLETON_KEY } }),
  ]);

  return {
    pendingImages,
    completeImages,
    failedImages,
    totalRegions,
    batch: {
      status: state?.status ?? "idle",
      totalPosts: state?.totalPosts ?? 0,
      processedPosts: state?.processedPosts ?? 0,
      failedPosts: state?.failedPosts ?? 0,
      errorMessage: state?.errorMessage ?? null,
      updatedAt: state?.updatedAt ?? null,
    },
  };
}
