import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as ScanPostModule from "./scan-post";

const {
  mockOcrPost,
  mockTranslateRegions,
  mockFinalizeScan,
  mockRenderPostInpaintedPage,
  mockMarkScanFailed,
  mockBatchUpdateMany,
  mockBatchFindUnique,
  mockBatchCreate,
  mockPostFindMany,
  mockPostCount,
  mockRegionCount,
} = vi.hoisted(() => ({
  mockOcrPost: vi.fn(),
  mockTranslateRegions: vi.fn(),
  mockFinalizeScan: vi.fn(),
  mockRenderPostInpaintedPage: vi.fn(),
  mockMarkScanFailed: vi.fn(),
  mockBatchUpdateMany: vi.fn(),
  mockBatchFindUnique: vi.fn(),
  mockBatchCreate: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockPostCount: vi.fn(),
  mockRegionCount: vi.fn(),
}));

vi.mock("./scan-post", async (importOriginal) => {
  const actual = await importOriginal<typeof ScanPostModule>();
  return {
    ...actual,
    ocrPost: mockOcrPost,
    translateRegions: mockTranslateRegions,
    finalizeScan: mockFinalizeScan,
    renderPostInpaintedPage: mockRenderPostInpaintedPage,
    markScanFailed: mockMarkScanFailed,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    ocrBatchState: {
      updateMany: mockBatchUpdateMany,
      findUnique: mockBatchFindUnique,
      create: mockBatchCreate,
    },
    post: { findMany: mockPostFindMany, count: mockPostCount },
    imageTextRegion: { count: mockRegionCount },
  },
}));


import {
  acquireOcrBatchLock,
  getOcrAdminStatus,
  requestOcrBatchCancel,
  requestOcrBatchReset,
  runOcrBatch,
  selectOcrBatchPosts,
} from "./batch";
import { OpenRouterApiError } from "@/lib/openrouter";
import { OcrServiceBusyError } from "./errors";

const post = (id: number) => ({ id, hash: `${id}`.padStart(64, "0"), extension: ".png", mimeType: "image/png" });

const region = () => ({
  readingOrder: 0,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  ocrText: "t",
  sourceLanguage: "ja",
  confidence: null,
  angle: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OCR_BUSY_RETRY_DELAYS_MS;
  mockBatchUpdateMany.mockResolvedValue({ count: 1 });
  mockBatchFindUnique.mockResolvedValue({ status: "running" });
  mockMarkScanFailed.mockResolvedValue(undefined);
  mockTranslateRegions.mockResolvedValue({ translated: [], targetLanguage: "en", failed: false });
  mockFinalizeScan.mockResolvedValue({
    hasText: false,
    translationFailed: false,
    scannedAt: new Date(),
    regions: [],
  });
  mockRenderPostInpaintedPage.mockResolvedValue(Buffer.from([9]));
});

describe("acquireOcrBatchLock", () => {
  it("wins when the conditional update claims a row", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 1 });
    await expect(acquireOcrBatchLock()).resolves.toBe(true);
    expect(mockBatchUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          key: "singleton",
          OR: expect.arrayContaining([
            { status: { notIn: ["running", "cancelling"] } },
            expect.objectContaining({ updatedAt: expect.objectContaining({ lt: expect.any(Date) }) }),
          ]),
        }),
      })
    );
  });

  it("claims through a predicate that can reclaim stale running rows", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 1 });

    await expect(acquireOcrBatchLock()).resolves.toBe(true);

    const where = mockBatchUpdateMany.mock.calls[0][0].where;
    // Unit level cannot prove real DB reclaim; this locks the stale-row predicate into the claim.
    expect(where).toEqual(
      expect.objectContaining({
        key: "singleton",
        OR: expect.arrayContaining([
          expect.objectContaining({ updatedAt: expect.objectContaining({ lt: expect.any(Date) }) }),
        ]),
      })
    );
  });

  it("loses when a row exists but is running", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockBatchFindUnique.mockResolvedValueOnce({ status: "running" });
    await expect(acquireOcrBatchLock()).resolves.toBe(false);
  });

  it("creates the row when none exists", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockBatchFindUnique.mockResolvedValueOnce(null);
    mockBatchCreate.mockResolvedValueOnce({});
    await expect(acquireOcrBatchLock()).resolves.toBe(true);
  });
});

describe("selectOcrBatchPosts", () => {
  it("selects PENDING images only by default, with limit", async () => {
    mockPostFindMany.mockResolvedValue([]);
    await selectOcrBatchPosts({ limit: 10 });
    expect(mockPostFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mimeType: { startsWith: "image/" },
          ocrStatus: { in: ["PENDING"] },
        }),
        take: 10,
      })
    );
  });

  it("includes FAILED when retryFailed and applies all-of tag filter", async () => {
    mockPostFindMany.mockResolvedValue([]);
    await selectOcrBatchPosts({ retryFailed: true, tags: ["comic", "jp"] });
    const arg = mockPostFindMany.mock.calls[0][0];
    expect(arg.where.ocrStatus).toEqual({ in: ["PENDING", "FAILED"] });
    expect(arg.where.AND).toHaveLength(2); // one `tags.some` clause per tag
  });
});

describe("runOcrBatch", () => {
  it("processes posts serially and reports counts", async () => {
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockResolvedValue([]);

    const result = await runOcrBatch({});
    expect(result.status).toBe("completed");
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockOcrPost).toHaveBeenCalledTimes(2);
    expect(mockRenderPostInpaintedPage).not.toHaveBeenCalled();
    expect(mockFinalizeScan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, hash: post(1).hash }),
      [],
      [],
      "en",
      null
    );
  });

  it("passes the rendered full-page inpaint into finalizeScan for region-bearing posts", async () => {
    const first = post(1);
    const page = Buffer.from([7, 7, 7]);
    const detected = region();
    mockPostFindMany.mockResolvedValue([first]);
    mockOcrPost.mockResolvedValue([detected]);
    mockTranslateRegions.mockResolvedValue({ translated: ["Hi"], targetLanguage: "en", failed: false });
    mockRenderPostInpaintedPage.mockResolvedValueOnce(page);

    const result = await runOcrBatch({});

    expect(result.status).toBe("completed");
    expect(result.processed).toBe(1);
    expect(mockRenderPostInpaintedPage).toHaveBeenCalledWith(first, { signal: expect.anything() });
    expect(mockFinalizeScan).toHaveBeenCalledWith(first, [detected], ["Hi"], "en", page);
    expect(mockFinalizeScan.mock.calls[0][4]).toBe(page);
  });

  it("skips full-page inpaint rendering and finalizes with null when OCR finds no regions", async () => {
    const first = post(1);
    mockPostFindMany.mockResolvedValue([first]);
    mockOcrPost.mockResolvedValue([]);

    const result = await runOcrBatch({});

    expect(result.status).toBe("completed");
    expect(mockRenderPostInpaintedPage).not.toHaveBeenCalled();
    expect(mockFinalizeScan).toHaveBeenCalledWith(first, [], [], "en", null);
  });

  it("continues after per-post OCR failures and counts them", async () => {
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockRejectedValueOnce(new Error("bad file")).mockResolvedValueOnce([]);

    const result = await runOcrBatch({});
    expect(result.status).toBe("completed");
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockMarkScanFailed).toHaveBeenCalledWith(1);
  });

  it("aborts on 401 auth errors from translation after preserving OCR-only data with the page", async () => {
    const first = post(1);
    const detected = region();
    const page = Buffer.from([4, 0, 1]);
    mockPostFindMany.mockResolvedValue([first, post(2)]);
    mockOcrPost.mockResolvedValue([detected]);
    mockRenderPostInpaintedPage.mockResolvedValueOnce(page);
    mockTranslateRegions.mockRejectedValue(new OpenRouterApiError("auth", 401));

    const result = await runOcrBatch({});
    expect(result.status).toBe("error");
    expect(mockOcrPost).toHaveBeenCalledTimes(1); // second post never scanned
    expect(mockFinalizeScan).toHaveBeenCalledWith(first, [detected], [null], null, page);
    expect(mockFinalizeScan.mock.calls[0][4]).toBe(page);
  });

  it("marks the post FAILED when 401 OCR-only recovery persistence fails", async () => {
    const first = post(1);
    const detected = region();
    const page = Buffer.from([4, 0, 1]);
    mockPostFindMany.mockResolvedValue([first]);
    mockOcrPost.mockResolvedValue([detected]);
    mockRenderPostInpaintedPage.mockResolvedValueOnce(page);
    mockTranslateRegions.mockRejectedValue(new OpenRouterApiError("auth", 401));
    mockFinalizeScan.mockRejectedValue(new Error("db down"));

    const result = await runOcrBatch({});
    expect(result.status).toBe("error");
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockFinalizeScan).toHaveBeenCalledWith(first, [detected], [null], null, page);
    expect(mockMarkScanFailed).toHaveBeenCalledWith(first.id);
  });

  it("retries a busy sidecar with backoff instead of failing the post", async () => {
    process.env.OCR_BUSY_RETRY_DELAYS_MS = "0,0";
    mockPostFindMany.mockResolvedValue([post(1)]);
    mockOcrPost
      .mockRejectedValueOnce(new OcrServiceBusyError("busy"))
      .mockRejectedValueOnce(new OcrServiceBusyError("busy"))
      .mockResolvedValueOnce([]);

    const result = await runOcrBatch({});

    expect(result.status).toBe("completed");
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockOcrPost).toHaveBeenCalledTimes(3);
    expect(mockMarkScanFailed).not.toHaveBeenCalled();
  });

  it("stops the batch and leaves posts PENDING when the sidecar stays busy", async () => {
    process.env.OCR_BUSY_RETRY_DELAYS_MS = "0,0";
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockRejectedValue(new OcrServiceBusyError("busy"));

    const result = await runOcrBatch({});

    expect(result.status).toBe("error");
    expect(result.processed).toBe(0);
    // A wedged sidecar is not a post failure: nothing gets flipped to FAILED
    // and the second post is never attempted.
    expect(result.failed).toBe(0);
    expect(mockMarkScanFailed).not.toHaveBeenCalled();
    expect(mockOcrPost).toHaveBeenCalledTimes(3); // initial attempt + 2 retries, post 1 only
    expect(result.errors[0]).toMatch(/busy/i);
  });

  it("retries a busy page render with backoff and then persists normally", async () => {
    process.env.OCR_BUSY_RETRY_DELAYS_MS = "0,0";
    mockPostFindMany.mockResolvedValue([post(1)]);
    mockOcrPost.mockResolvedValue([region()]);
    mockRenderPostInpaintedPage
      .mockRejectedValueOnce(new OcrServiceBusyError("busy"))
      .mockResolvedValueOnce(Buffer.from([9]));

    const result = await runOcrBatch({});

    expect(result.status).toBe("completed");
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockRenderPostInpaintedPage).toHaveBeenCalledTimes(2);
    expect(mockFinalizeScan).toHaveBeenCalledTimes(1);
  });

  it("stops the batch when the render stage stays busy, leaving posts PENDING", async () => {
    // Both sidecar stages share the single worker; busy on the render call
    // must not degrade to a page-less COMPLETE post (that would delete an
    // existing inpaint) nor fail the post — it stops the batch like a busy
    // OCR call.
    process.env.OCR_BUSY_RETRY_DELAYS_MS = "0,0";
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockResolvedValue([region()]);
    mockRenderPostInpaintedPage.mockRejectedValue(new OcrServiceBusyError("busy"));

    const result = await runOcrBatch({});

    expect(result.status).toBe("error");
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockMarkScanFailed).not.toHaveBeenCalled();
    expect(mockRenderPostInpaintedPage).toHaveBeenCalledTimes(3); // initial + 2 retries, post 1 only
    expect(mockFinalizeScan).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/busy/i);
  });

  it("stops between posts when cancellation was requested", async () => {
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockResolvedValue([]);
    // First status poll: running; second: cancelling.
    mockBatchFindUnique
      .mockResolvedValueOnce({ status: "running" })
      .mockResolvedValueOnce({ status: "cancelling" });

    const result = await runOcrBatch({});
    expect(result.status).toBe("cancelled");
    expect(mockOcrPost).toHaveBeenCalledTimes(1);
  });

  it("stops when a force-reset marks the batch cancelled", async () => {
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockResolvedValue([]);
    // First status poll: running; second: cancelled by an external reset.
    mockBatchFindUnique
      .mockResolvedValueOnce({ status: "running" })
      .mockResolvedValueOnce({ status: "cancelled" });

    const result = await runOcrBatch({});
    expect(result.status).toBe("cancelled");
    expect(mockOcrPost).toHaveBeenCalledTimes(1);
  });

  it("marks the post FAILED on a non-401 persist error in the pool", async () => {
    mockPostFindMany.mockResolvedValue([post(1)]);
    mockOcrPost.mockResolvedValue([region()]);
    // Non-401 failure in the translate+persist pool.
    mockFinalizeScan.mockRejectedValueOnce(new Error("db down"));

    const result = await runOcrBatch({});
    expect(result.status).toBe("completed");
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    // Must not leave the post silently PENDING; a retry pass depends on FAILED.
    expect(mockMarkScanFailed).toHaveBeenCalledWith(1);
  });
});

describe("requestOcrBatchCancel", () => {
  it("flips the running singleton to cancelling and reports true", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 1 });
    await expect(requestOcrBatchCancel()).resolves.toBe(true);
    expect(mockBatchUpdateMany).toHaveBeenCalledWith({
      where: { key: "singleton", status: "running" },
      data: { status: "cancelling" },
    });
  });

  it("reports false when no batch is running", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(requestOcrBatchCancel()).resolves.toBe(false);
  });
});

describe("requestOcrBatchReset", () => {
  it("force-resets a running or cancelling singleton row and reports true", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 1 });

    await expect(requestOcrBatchReset()).resolves.toBe(true);

    expect(mockBatchUpdateMany).toHaveBeenCalledWith({
      where: { key: "singleton", status: { in: ["running", "cancelling"] } },
      data: expect.objectContaining({ status: "cancelled" }),
    });
  });

  it("reports false when no running or cancelling row was reset", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(requestOcrBatchReset()).resolves.toBe(false);
  });
});

describe("getOcrAdminStatus", () => {
  it("aggregates post counts with the singleton batch state", async () => {
    // Promise.all order: PENDING, COMPLETE, FAILED counts, then regions.
    mockPostCount.mockResolvedValueOnce(3).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    mockRegionCount.mockResolvedValueOnce(42);
    const updatedAt = new Date("2026-07-06T12:34:56.000Z");
    mockBatchFindUnique.mockResolvedValueOnce({
      status: "running",
      totalPosts: 10,
      processedPosts: 4,
      failedPosts: 1,
      errorMessage: null,
      updatedAt,
    });

    const status = await getOcrAdminStatus();
    expect(status).toEqual({
      pendingImages: 3,
      completeImages: 5,
      failedImages: 2,
      totalRegions: 42,
      batch: {
        status: "running",
        totalPosts: 10,
        processedPosts: 4,
        failedPosts: 1,
        errorMessage: null,
        updatedAt,
      },
    });
    expect(mockBatchFindUnique).toHaveBeenCalledWith({ where: { key: "singleton" } });
  });

  it("falls back to idle defaults when no batch row exists", async () => {
    mockPostCount.mockResolvedValue(0);
    mockRegionCount.mockResolvedValueOnce(0);
    mockBatchFindUnique.mockResolvedValueOnce(null);

    const status = await getOcrAdminStatus();
    expect(status.batch).toEqual({
      status: "idle",
      totalPosts: 0,
      processedPosts: 0,
      failedPosts: 0,
      errorMessage: null,
      updatedAt: null,
    });
  });
});
