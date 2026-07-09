/**
 * In-process runner for the admin maintenance batches (thumbnails, phash,
 * embeddings): one background batch per route, a 409 guard against overlap,
 * and progress/status snapshots for the polling UI.
 *
 * NOTE: state is module-instance memory, so the guard only holds within a
 * single Next.js process — same single-instance assumption as before this
 * was extracted (see "Deployment / Concurrency" in CLAUDE.md).
 */

export type BatchRunStatus = "idle" | "running" | "completed" | "failed";

export interface BatchProgress {
  processed: number;
  total: number;
}

export interface BatchRunnerSnapshot<R> {
  batchRunning: boolean;
  /** Null unless a batch is currently running. */
  batchProgress: BatchProgress | null;
  batchStatus: BatchRunStatus;
  batchError: string | null;
  lastBatchResult: R | null;
}

export interface BatchRunner<R> {
  /** Whether a batch is currently in flight (for 409 guards). */
  readonly running: boolean;
  /** Status fields for the route's GET payload. */
  snapshot(): BatchRunnerSnapshot<R>;
  /**
   * Start `run` in the background unless a batch is already in flight.
   * Returns false when busy — the caller responds 409.
   */
  start(
    run: (onProgress: (processed: number, total: number) => void) => Promise<R>,
    callbacks?: {
      onCompleted?: (result: R) => void;
      onFailed?: (message: string) => void;
      /** Runs after completion or failure, e.g. cache invalidation. */
      onSettled?: () => void;
    }
  ): boolean;
}

export function createBatchRunner<R>(): BatchRunner<R> {
  let running = false;
  let progress: BatchProgress = { processed: 0, total: 0 };
  let status: BatchRunStatus = "idle";
  let error: string | null = null;
  let lastResult: R | null = null;

  return {
    get running() {
      return running;
    },
    snapshot() {
      return {
        batchRunning: running,
        batchProgress: running ? progress : null,
        batchStatus: status,
        batchError: error,
        lastBatchResult: lastResult,
      };
    },
    start(run, callbacks = {}) {
      if (running) return false;

      running = true;
      progress = { processed: 0, total: 0 };
      status = "running";
      error = null;
      lastResult = null;

      run((processed, total) => {
        progress = { processed, total };
      })
        .then((result) => {
          status = "completed";
          lastResult = result;
          callbacks.onCompleted?.(result);
        })
        .catch((err) => {
          status = "failed";
          error = err instanceof Error ? err.message : String(err);
          callbacks.onFailed?.(error);
        })
        .finally(() => {
          running = false;
          callbacks.onSettled?.();
        });

      return true;
    },
  };
}
