import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as ScanPostModule from "./scan-post";

const {
  mockOcrPost,
  mockTranslateRegions,
  mockPersistScan,
  mockMarkScanFailed,
  mockBatchUpdateMany,
  mockBatchFindUnique,
  mockBatchCreate,
  mockPostFindMany,
  mockPostCount,
  mockRegionCount,
  mockStoreCrops,
} = vi.hoisted(() => ({
  mockOcrPost: vi.fn(),
  mockTranslateRegions: vi.fn(),
  mockPersistScan: vi.fn(),
  mockMarkScanFailed: vi.fn(),
  mockBatchUpdateMany: vi.fn(),
  mockBatchFindUnique: vi.fn(),
  mockBatchCreate: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockPostCount: vi.fn(),
  mockRegionCount: vi.fn(),
  mockStoreCrops: vi.fn(),
}));

vi.mock("./scan-post", async (importOriginal) => {
  const actual = await importOriginal<typeof ScanPostModule>();
  return {
    ...actual,
    ocrPost: mockOcrPost,
    translateRegions: mockTranslateRegions,
    persistScan: mockPersistScan,
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

vi.mock("./crops", () => ({ storeCrops: mockStoreCrops }));

import {
  acquireOcrBatchLock,
  getOcrAdminStatus,
  requestOcrBatchCancel,
  runOcrBatch,
  selectOcrBatchPosts,
} from "./batch";
import { OpenRouterApiError } from "@/lib/openrouter";

const post = (id: number) => ({ id, hash: `${id}`.padStart(64, "0"), extension: ".png", mimeType: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
  mockBatchUpdateMany.mockResolvedValue({ count: 1 });
  mockBatchFindUnique.mockResolvedValue({ status: "running" });
  mockMarkScanFailed.mockResolvedValue(undefined);
  mockTranslateRegions.mockResolvedValue({ translated: [], targetLanguage: "en", failed: false });
  mockPersistScan.mockResolvedValue({
    hasText: false,
    translationFailed: false,
    scannedAt: new Date(),
    regions: [],
  });
  mockStoreCrops.mockResolvedValue([true]);
});

describe("acquireOcrBatchLock", () => {
  it("wins when the conditional update claims a row", async () => {
    mockBatchUpdateMany.mockResolvedValueOnce({ count: 1 });
    await expect(acquireOcrBatchLock()).resolves.toBe(true);
    expect(mockBatchUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "singleton", status: { notIn: ["running", "cancelling"] } },
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
    expect(mockStoreCrops).toHaveBeenCalledWith(post(1).hash, expect.any(Array));
    expect(mockPersistScan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, hash: post(1).hash }),
      expect.any(Array),
      expect.any(Array),
      "en",
      [true]
    );
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

  it("aborts on 401 auth errors from translation", async () => {
    mockPostFindMany.mockResolvedValue([post(1), post(2)]);
    mockOcrPost.mockResolvedValue([
      { readingOrder: 0, x: 0, y: 0, width: 1, height: 1, ocrText: "t", sourceLanguage: "ja", confidence: null, angle: null },
    ]);
    mockTranslateRegions.mockRejectedValue(new OpenRouterApiError("auth", 401));

    const result = await runOcrBatch({});
    expect(result.status).toBe("error");
    expect(mockOcrPost).toHaveBeenCalledTimes(1); // second post never scanned
    expect(mockStoreCrops).toHaveBeenCalledWith(post(1).hash, expect.any(Array));
    expect(mockPersistScan).toHaveBeenCalledWith(
      expect.objectContaining({ hash: post(1).hash }),
      expect.any(Array),
      [null],
      null,
      [true]
    );
    expect(mockStoreCrops.mock.invocationCallOrder[0]).toBeLessThan(
      mockPersistScan.mock.invocationCallOrder[0]
    );
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

  it("marks the post FAILED on a non-401 persist error in the pool", async () => {
    mockPostFindMany.mockResolvedValue([post(1)]);
    mockOcrPost.mockResolvedValue([
      { readingOrder: 0, x: 0, y: 0, width: 1, height: 1, ocrText: "t", sourceLanguage: "ja", confidence: null, angle: null },
    ]);
    // Non-401 failure in the translate+persist pool.
    mockPersistScan.mockRejectedValueOnce(new Error("db down"));

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

describe("getOcrAdminStatus", () => {
  it("aggregates post counts with the singleton batch state", async () => {
    // Promise.all order: PENDING, COMPLETE, FAILED counts, then regions.
    mockPostCount.mockResolvedValueOnce(3).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    mockRegionCount.mockResolvedValueOnce(42);
    mockBatchFindUnique.mockResolvedValueOnce({
      status: "running",
      totalPosts: 10,
      processedPosts: 4,
      failedPosts: 1,
      errorMessage: null,
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
    });
  });
});
