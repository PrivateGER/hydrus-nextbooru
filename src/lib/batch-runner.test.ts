import { describe, expect, it, vi } from "vitest";
import { createBatchRunner } from "./batch-runner";

/** Let the runner's promise chain settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createBatchRunner", () => {
  it("starts idle with an empty snapshot", () => {
    const runner = createBatchRunner<number>();

    expect(runner.running).toBe(false);
    expect(runner.snapshot()).toEqual({
      batchRunning: false,
      batchProgress: null,
      batchStatus: "idle",
      batchError: null,
      lastBatchResult: null,
    });
  });

  it("tracks progress while running and completes with the result", async () => {
    const runner = createBatchRunner<string>();
    const onCompleted = vi.fn();
    const onSettled = vi.fn();

    let resolveRun!: (value: string) => void;
    let reportProgress!: (processed: number, total: number) => void;

    const started = runner.start(
      (onProgress) => {
        reportProgress = onProgress;
        return new Promise<string>((resolve) => {
          resolveRun = resolve;
        });
      },
      { onCompleted, onSettled }
    );

    expect(started).toBe(true);
    expect(runner.running).toBe(true);
    expect(runner.snapshot().batchStatus).toBe("running");

    reportProgress(3, 10);
    expect(runner.snapshot().batchProgress).toEqual({ processed: 3, total: 10 });

    resolveRun("done");
    await flush();

    expect(runner.running).toBe(false);
    expect(runner.snapshot()).toMatchObject({
      batchRunning: false,
      batchProgress: null,
      batchStatus: "completed",
      batchError: null,
      lastBatchResult: "done",
    });
    expect(onCompleted).toHaveBeenCalledWith("done");
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("returns false when a batch is already in flight", async () => {
    const runner = createBatchRunner<void>();

    let resolveRun!: () => void;
    runner.start(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );

    expect(runner.start(() => Promise.resolve())).toBe(false);

    resolveRun();
    await flush();
    expect(runner.running).toBe(false);
  });

  it("records a rejected run as failed and unlocks", async () => {
    const runner = createBatchRunner<void>();
    const onFailed = vi.fn();
    const onSettled = vi.fn();

    runner.start(() => Promise.reject(new Error("boom")), { onFailed, onSettled });
    await flush();

    expect(runner.running).toBe(false);
    expect(runner.snapshot()).toMatchObject({
      batchStatus: "failed",
      batchError: "boom",
      lastBatchResult: null,
    });
    expect(onFailed).toHaveBeenCalledWith("boom");
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does not stay locked when run throws synchronously", async () => {
    const runner = createBatchRunner<void>();
    const onFailed = vi.fn();

    runner.start(
      () => {
        throw new Error("sync boom");
      },
      { onFailed }
    );
    await flush();

    expect(runner.running).toBe(false);
    expect(runner.snapshot().batchStatus).toBe("failed");
    expect(runner.snapshot().batchError).toBe("sync boom");
    expect(onFailed).toHaveBeenCalledWith("sync boom");

    // Runner is reusable after the failure.
    expect(runner.start(() => Promise.resolve())).toBe(true);
    await flush();
    expect(runner.snapshot().batchStatus).toBe("completed");
  });

  it("resets error state when a new batch starts", async () => {
    const runner = createBatchRunner<void>();

    runner.start(() => Promise.reject(new Error("first")));
    await flush();
    expect(runner.snapshot().batchError).toBe("first");

    let resolveRun!: () => void;
    runner.start(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    expect(runner.snapshot()).toMatchObject({
      batchStatus: "running",
      batchError: null,
      batchProgress: { processed: 0, total: 0 },
    });

    resolveRun();
    await flush();
  });
});
