import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockBatchComputeEmbeddings,
  mockClearEmbeddingsForConfig,
  mockDeleteFailedEmbeddingsForConfig,
  mockGetEmbeddingSettings,
  mockGetEmbeddingStats,
  mockUpdateEmbeddingSettings,
  mockRekeyVideoEmbeddings,
  mockInvalidateFeedCache,
  mockClearTasteCaches,
  mockInvalidateEmbeddingCalibration,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockBatchComputeEmbeddings: vi.fn(),
  mockClearEmbeddingsForConfig: vi.fn(),
  mockDeleteFailedEmbeddingsForConfig: vi.fn(),
  mockGetEmbeddingSettings: vi.fn(),
  mockGetEmbeddingStats: vi.fn(),
  mockUpdateEmbeddingSettings: vi.fn(),
  mockRekeyVideoEmbeddings: vi.fn(),
  mockInvalidateFeedCache: vi.fn(),
  mockClearTasteCaches: vi.fn(),
  mockInvalidateEmbeddingCalibration: vi.fn(),
}));

vi.mock("@/lib/embeddings", () => ({
  batchComputeEmbeddings: mockBatchComputeEmbeddings,
  clearEmbeddingsForConfig: mockClearEmbeddingsForConfig,
  DEFAULT_EMBEDDING_BATCH_SIZE: 8,
  deleteFailedEmbeddingsForConfig: mockDeleteFailedEmbeddingsForConfig,
  getEmbeddingSettings: mockGetEmbeddingSettings,
  getEmbeddingStats: mockGetEmbeddingStats,
  isSupportedEmbeddingResolution: (value: number) => [512, 768, 1024, 1536, 2048].includes(value),
  MAX_EMBEDDING_BATCH_SIZE: 64,
  normalizeEmbeddingBaseUrl: (value: string | null | undefined) => value || "https://openrouter.ai/api/v1",
  rekeyVideoEmbeddings: mockRekeyVideoEmbeddings,
  toEmbeddingConfig: (settings: unknown) => settings,
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
  clearTasteCaches: mockClearTasteCaches,
}));

vi.mock("@/lib/embeddings/calibration", () => ({
  invalidateEmbeddingCalibration: mockInvalidateEmbeddingCalibration,
}));

const SETTINGS = {
  maskedApiKey: "sk-***",
  apiKeyConfigured: true,
  apiKeyRequired: true,
  baseUrl: null,
  model: "test-model",
  dimensions: 768,
  imageMaxResolution: 1024,
  videoEnabled: false,
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
  });

  it("GET merges settings, stats, and the batch snapshot", async () => {
    const { GET } = await import("./route");
    const data = await (await GET()).json();

    expect(data.settings).toMatchObject({ model: "test-model", dimensions: 768 });
    expect(data.stats).toMatchObject({ embedded: 4 });
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
    const response = await PUT(request("PUT", { model: "new-model", dimensions: 512, videoEnabled: true }));

    expect(response.status).toBe(200);
    expect(mockUpdateEmbeddingSettings).toHaveBeenCalledWith(
      expect.objectContaining({ model: "new-model", dimensions: 512, videoEnabled: true })
    );
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it("PUT ignores a non-boolean videoEnabled", async () => {
    const { PUT } = await import("./route");
    await PUT(request("PUT", { videoEnabled: "true" }));

    expect(mockUpdateEmbeddingSettings).toHaveBeenCalledWith(
      expect.objectContaining({ videoEnabled: undefined })
    );
  });

  it("PUT re-keys video rows to a new image resolution before saving, and moves them back if the save fails", async () => {
    mockRekeyVideoEmbeddings.mockResolvedValue(5);
    const { PUT } = await import("./route");

    await PUT(request("PUT", { model: "test-model", dimensions: 768, imageMaxResolution: 2048 }));
    expect(mockRekeyVideoEmbeddings).toHaveBeenCalledWith(expect.objectContaining({ imageMaxResolution: 1024 }), 2048);
    expect(mockRekeyVideoEmbeddings.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateEmbeddingSettings.mock.invocationCallOrder[0]
    );

    mockRekeyVideoEmbeddings.mockClear();
    mockUpdateEmbeddingSettings.mockRejectedValueOnce(new Error("db down"));
    const response = await PUT(request("PUT", { imageMaxResolution: 2048 }));
    expect(response.status).toBe(400);
    expect(mockRekeyVideoEmbeddings.mock.calls).toEqual([
      [expect.objectContaining({ imageMaxResolution: 1024 }), 2048],
      [expect.objectContaining({ imageMaxResolution: 2048 }), 1024],
    ]);

    // Changing the model alongside the resolution is a new identity: nothing to move.
    mockRekeyVideoEmbeddings.mockClear();
    await PUT(request("PUT", { model: "other-model", imageMaxResolution: 2048 }));
    expect(mockRekeyVideoEmbeddings).not.toHaveBeenCalled();
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
    mockBatchComputeEmbeddings.mockResolvedValueOnce({ processed: 5, succeeded: 5, failed: 0 });
    const { GET, POST } = await import("./route");

    const response = await POST(request("POST", { retryFailed: true }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.retryFailed).toBe(true);
    expect(mockBatchComputeEmbeddings).toHaveBeenCalledWith(
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
    mockBatchComputeEmbeddings.mockRejectedValueOnce(new Error("provider down"));
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
    expect(mockBatchComputeEmbeddings).not.toHaveBeenCalled();
  });

  it("POST, PUT, and DELETE return 409 while a batch is running", async () => {
    let resolveBatch!: (value: { processed: number; succeeded: number; failed: number }) => void;
    mockBatchComputeEmbeddings.mockReturnValueOnce(
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

  it("DELETE clears current embeddings, the taste caches, and the feed cache", async () => {
    mockClearEmbeddingsForConfig.mockResolvedValueOnce(12);
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE", { clearCurrent: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(12);
    expect(mockInvalidateFeedCache).toHaveBeenCalledTimes(1);
    expect(mockClearTasteCaches).toHaveBeenCalledTimes(1);
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
});
