import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockBatchComputeImageEmbeddings,
  mockBatchComputeTagEmbeddings,
  mockClearEmbeddingsForConfig,
  mockClearTagEmbeddingsForConfig,
  mockDeleteFailedEmbeddingsForConfig,
  mockDeleteFailedTagEmbeddingsForConfig,
  mockGetEmbeddingSettings,
  mockGetEmbeddingStats,
  mockGetTagEmbeddingStats,
  mockUpdateEmbeddingSettings,
  mockInvalidateFeedCache,
  mockInvalidateEmbeddingCalibration,
  mockInvalidateTagEmbeddingCalibration,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockBatchComputeImageEmbeddings: vi.fn(),
  mockBatchComputeTagEmbeddings: vi.fn(),
  mockClearEmbeddingsForConfig: vi.fn(),
  mockClearTagEmbeddingsForConfig: vi.fn(),
  mockDeleteFailedEmbeddingsForConfig: vi.fn(),
  mockDeleteFailedTagEmbeddingsForConfig: vi.fn(),
  mockGetEmbeddingSettings: vi.fn(),
  mockGetEmbeddingStats: vi.fn(),
  mockGetTagEmbeddingStats: vi.fn(),
  mockUpdateEmbeddingSettings: vi.fn(),
  mockInvalidateFeedCache: vi.fn(),
  mockInvalidateEmbeddingCalibration: vi.fn(),
  mockInvalidateTagEmbeddingCalibration: vi.fn(),
}));

vi.mock("@/lib/embeddings", () => ({
  batchComputeImageEmbeddings: mockBatchComputeImageEmbeddings,
  batchComputeTagEmbeddings: mockBatchComputeTagEmbeddings,
  clearEmbeddingsForConfig: mockClearEmbeddingsForConfig,
  clearTagEmbeddingsForConfig: mockClearTagEmbeddingsForConfig,
  DEFAULT_EMBEDDING_BATCH_SIZE: 8,
  DEFAULT_TAG_EMBEDDING_BATCH_SIZE: 64,
  deleteFailedEmbeddingsForConfig: mockDeleteFailedEmbeddingsForConfig,
  deleteFailedTagEmbeddingsForConfig: mockDeleteFailedTagEmbeddingsForConfig,
  getEmbeddingSettings: mockGetEmbeddingSettings,
  getEmbeddingStats: mockGetEmbeddingStats,
  getTagEmbeddingStats: mockGetTagEmbeddingStats,
  MAX_EMBEDDING_BATCH_SIZE: 64,
  MAX_TAG_EMBEDDING_BATCH_SIZE: 256,
  toEmbeddingConfig: (settings: unknown) => settings,
  toTagEmbeddingConfig: (config: unknown) => config,
  updateEmbeddingSettings: mockUpdateEmbeddingSettings,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: vi.fn() },
  aiLog: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/feed", () => ({
  invalidateFeedCache: mockInvalidateFeedCache,
}));

vi.mock("@/lib/embeddings/calibration", () => ({
  invalidateEmbeddingCalibration: mockInvalidateEmbeddingCalibration,
  invalidateTagEmbeddingCalibration: mockInvalidateTagEmbeddingCalibration,
}));

const SETTINGS = {
  maskedApiKey: "sk-***",
  apiKeyConfigured: true,
  apiKeyRequired: true,
  baseUrl: null,
  model: "test-model",
  dimensions: 768,
  imageMaxResolution: 1024,
};

function request(method: "POST" | "PUT" | "DELETE", body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/embeddings", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("admin embeddings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockGetEmbeddingSettings.mockResolvedValue(SETTINGS);
    mockGetEmbeddingStats.mockResolvedValue({ total: 10, embedded: 4, failed: 1, pending: 5, unsupported: 0 });
    mockGetTagEmbeddingStats.mockResolvedValue({ totalTags: 6, embedded: 2, failed: 1, pending: 3 });
  });

  it("GET merges settings, stats, and the batch snapshot", async () => {
    const { GET } = await import("./route");
    const data = await (await GET()).json();

    expect(data.settings).toMatchObject({ model: "test-model", dimensions: 768 });
    expect(data.stats).toMatchObject({ embedded: 4 });
    expect(data.tagStats).toEqual({ totalTags: 6, embedded: 2, failed: 1, pending: 3 });
    expect(data).toMatchObject({
      batchRunning: false,
      batchProgress: null,
      batchStatus: "idle",
      batchError: null,
      lastBatchResult: null,
    });
  });

  it("PUT saves settings and invalidates the feed cache", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(request("PUT", { model: "new-model", dimensions: 512 }));

    expect(response.status).toBe(200);
    expect(mockUpdateEmbeddingSettings).toHaveBeenCalledWith(
      expect.objectContaining({ model: "new-model", dimensions: 512 })
    );
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it("PUT surfaces validation errors as 400", async () => {
    mockUpdateEmbeddingSettings.mockRejectedValueOnce(new Error("bad base url"));
    const { PUT } = await import("./route");
    const response = await PUT(request("PUT", { baseUrl: "nope" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("bad base url");
  });

  it("POST starts a batch, then reports completion and invalidates the feed cache", async () => {
    mockBatchComputeImageEmbeddings.mockResolvedValueOnce({ processed: 5, succeeded: 5, failed: 0 });
    const { GET, POST } = await import("./route");

    const response = await POST(request("POST", { retryFailed: true }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.retryFailed).toBe(true);
    expect(mockBatchComputeImageEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ retryFailed: true })
    );

    await flush();
    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("completed");
    expect(data.lastBatchResult).toEqual({ processed: 5, succeeded: 5, failed: 0 });
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
    // Settlement must also drop the persisted calibration baseline: its
    // sample may predate rows this batch added. Ordering matters — the feed
    // cache falls AFTER the calibration delete, or a racing feed build could
    // cache the stale baseline with nothing left to evict it.
    expect(mockInvalidateEmbeddingCalibration).toHaveBeenCalledTimes(1);
    expect(mockInvalidateEmbeddingCalibration.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvalidateFeedCache.mock.invocationCallOrder[0]
    );
  });

  it("POST reports a failed batch and still invalidates the feed cache", async () => {
    mockBatchComputeImageEmbeddings.mockRejectedValueOnce(new Error("provider down"));
    const { GET, POST } = await import("./route");

    await POST(request("POST", {}));
    await flush();

    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("failed");
    expect(data.batchError).toBe("provider down");
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
    // Even a failed batch commits partial rows before dying — re-sample.
    expect(mockInvalidateEmbeddingCalibration).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["batchSize is zero", { batchSize: 0 }],
    ["batchSize exceeds the max", { batchSize: 65 }],
    ["limit is negative", { limit: -2 }],
  ])("POST rejects invalid input when %s", async (_label, body) => {
    const { POST } = await import("./route");
    const response = await POST(request("POST", body));

    expect(response.status).toBe(400);
    expect(mockBatchComputeImageEmbeddings).not.toHaveBeenCalled();
  });

  it("POST, PUT, and DELETE return 409 while a batch is running", async () => {
    let resolveBatch!: (value: { processed: number; succeeded: number; failed: number }) => void;
    mockBatchComputeImageEmbeddings.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      })
    );
    const { POST, PUT, DELETE } = await import("./route");

    expect((await POST(request("POST", {}))).status).toBe(200);
    expect((await POST(request("POST", {}))).status).toBe(409);
    expect((await PUT(request("PUT", { model: "x" }))).status).toBe(409);
    expect((await DELETE(request("DELETE", { clearCurrent: true }))).status).toBe(409);

    resolveBatch({ processed: 0, succeeded: 0, failed: 0 });
    await flush();
  });

  it("DELETE clears current embeddings and invalidates the feed cache", async () => {
    mockClearEmbeddingsForConfig.mockResolvedValueOnce(12);
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE", { clearCurrent: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(12);
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
    // The wiped store was the calibration sample source — the persisted
    // baseline must drop with it.
    expect(mockInvalidateEmbeddingCalibration).toHaveBeenCalledTimes(1);
  });

  it("DELETE clears failed embeddings without touching the feed cache", async () => {
    mockDeleteFailedEmbeddingsForConfig.mockResolvedValueOnce(3);
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE", { clearFailed: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(3);
    expect(mockInvalidateFeedCache).not.toHaveBeenCalled();
    // FAILED rows never feed the calibration sample; the baseline survives.
    expect(mockInvalidateEmbeddingCalibration).not.toHaveBeenCalled();
  });

  it("DELETE without an action returns 400", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(request("DELETE", {}))).status).toBe(400);
  });

  it("POST target=tags starts the tag batch and invalidates only tag calibration on settle", async () => {
    mockBatchComputeTagEmbeddings.mockResolvedValueOnce({ processed: 3, succeeded: 3, failed: 0 });
    const { GET, POST } = await import("./route");

    const response = await POST(request("POST", { target: "tags", retryFailed: true }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.retryFailed).toBe(true);
    expect(mockBatchComputeTagEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ retryFailed: true })
    );
    expect(mockBatchComputeImageEmbeddings).not.toHaveBeenCalled();

    await flush();
    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("completed");
    expect(data.lastBatchResult).toEqual({ processed: 3, succeeded: 3, failed: 0 });
    // New tag rows can displace the tag channel's calibration sample...
    expect(mockInvalidateTagEmbeddingCalibration).toHaveBeenCalledTimes(1);
    // ...but the feed and the image channel never read tag embeddings.
    expect(mockInvalidateFeedCache).not.toHaveBeenCalled();
    expect(mockInvalidateEmbeddingCalibration).not.toHaveBeenCalled();
  });

  it("POST target=tags accepts batch sizes above the image maximum", async () => {
    mockBatchComputeTagEmbeddings.mockResolvedValueOnce({ processed: 0, succeeded: 0, failed: 0 });
    const { POST } = await import("./route");

    const response = await POST(request("POST", { target: "tags", batchSize: 256 }));
    expect(response.status).toBe(200);

    await flush();
  });

  it("POST target=tags rejects batch sizes above the tag maximum", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("POST", { target: "tags", batchSize: 257 }));

    expect(response.status).toBe(400);
    expect(mockBatchComputeTagEmbeddings).not.toHaveBeenCalled();
  });

  it("DELETE clears tag embeddings and drops the tag calibration baseline", async () => {
    mockClearTagEmbeddingsForConfig.mockResolvedValueOnce(7);
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE", { clearTags: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(7);
    expect(mockInvalidateTagEmbeddingCalibration).toHaveBeenCalledTimes(1);
    expect(mockInvalidateFeedCache).not.toHaveBeenCalled();
  });

  it("DELETE clears failed tag embeddings without touching calibration", async () => {
    mockDeleteFailedTagEmbeddingsForConfig.mockResolvedValueOnce(2);
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE", { clearTagsFailed: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(mockInvalidateTagEmbeddingCalibration).not.toHaveBeenCalled();
  });
});
