import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockBatchGenerateThumbnails,
  mockGetThumbnailStats,
  mockApiLogError,
  mockThumbnailLogInfo,
  mockThumbnailLogError,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockBatchGenerateThumbnails: vi.fn(),
  mockGetThumbnailStats: vi.fn(),
  mockApiLogError: vi.fn(),
  mockThumbnailLogInfo: vi.fn(),
  mockThumbnailLogError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    thumbnail: { deleteMany: vi.fn() },
    post: { updateMany: vi.fn() },
  },
}));

vi.mock("fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/thumbnails", () => ({
  getThumbnailStats: mockGetThumbnailStats,
  batchGenerateThumbnails: mockBatchGenerateThumbnails,
  ThumbnailStatus: {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETE: "COMPLETE",
    FAILED: "FAILED",
    UNSUPPORTED: "UNSUPPORTED",
  },
  getThumbnailBasePath: () => "/tmp/thumbs",
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: mockApiLogError },
  thumbnailLog: { info: mockThumbnailLogInfo, error: mockThumbnailLogError, warn: vi.fn() },
}));

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/thumbnails", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/admin/thumbnails body validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    // Resolve immediately so the background job settles without error noise.
    mockBatchGenerateThumbnails.mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 });
  });

  it.each([
    ["batchSize is zero", { batchSize: 0 }, "batchSize"],
    ["batchSize is negative", { batchSize: -5 }, "batchSize"],
    ["batchSize is fractional", { batchSize: 3.5 }, "batchSize"],
    ["batchSize is NaN", { batchSize: Number.NaN }, "batchSize"],
    ["batchSize exceeds max", { batchSize: 1001 }, "batchSize"],
    ["batchSize is a string", { batchSize: "50" }, "batchSize"],
    ["limit is negative", { limit: -1 }, "limit"],
    ["limit is fractional", { limit: 10.2 }, "limit"],
    ["limit is Infinity", { limit: Number.POSITIVE_INFINITY }, "limit"],
    ["limit exceeds max", { limit: 10_000_001 }, "limit"],
  ])("rejects when %s with 400", async (_label, body, field) => {
    const { POST } = await import("./route");
    const response = await POST(postRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain(field);
    expect(mockBatchGenerateThumbnails).not.toHaveBeenCalled();
  });

  it("accepts valid bounds and starts the batch (200)", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ limit: 100, batchSize: 25 }));

    expect(response.status).toBe(200);
    expect(mockBatchGenerateThumbnails).toHaveBeenCalledTimes(1);
    expect(mockBatchGenerateThumbnails).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, batchSize: 25 })
    );
  });

  it("accepts an empty body (both fields optional) and starts the batch", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({}));

    expect(response.status).toBe(200);
    expect(mockBatchGenerateThumbnails).toHaveBeenCalledTimes(1);
  });

  it("accepts limit of 0 as a valid non-negative integer", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ limit: 0 }));

    expect(response.status).toBe(200);
    expect(mockBatchGenerateThumbnails).toHaveBeenCalledTimes(1);
  });

  it("returns 401 and skips validation when not authorized", async () => {
    mockVerifyAdminSession.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("./route");
    const response = await POST(postRequest({ batchSize: -5 }));

    expect(response.status).toBe(401);
    expect(mockBatchGenerateThumbnails).not.toHaveBeenCalled();
  });
});

describe("thumbnail batch lifecycle", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockGetThumbnailStats.mockResolvedValue({ total: 1, pending: 0, complete: 1 });
  });

  it("reports a completed batch in the GET snapshot", async () => {
    mockBatchGenerateThumbnails.mockResolvedValueOnce({ processed: 2, succeeded: 2, failed: 0 });
    const { GET, POST } = await import("./route");

    await POST(postRequest({}));
    await flush();

    const data = await (await GET()).json();
    expect(data.batchRunning).toBe(false);
    expect(data.batchStatus).toBe("completed");
    expect(data.batchError).toBeNull();
    expect(data.lastBatchResult).toEqual({ processed: 2, succeeded: 2, failed: 0 });
    expect(mockThumbnailLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ processed: 2, succeeded: 2, failed: 0 }),
      expect.stringContaining("completed")
    );
  });

  it("reports a failed batch with its error in the GET snapshot", async () => {
    mockBatchGenerateThumbnails.mockRejectedValueOnce(new Error("disk full"));
    const { GET, POST } = await import("./route");

    await POST(postRequest({}));
    await flush();

    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("failed");
    expect(data.batchError).toBe("disk full");
    expect(mockThumbnailLogError).toHaveBeenCalledWith(
      { error: "disk full" },
      expect.stringContaining("failed")
    );
  });

  it("returns 409 for POST and blocking DELETE while a batch is running", async () => {
    let resolveBatch!: (value: { processed: number; succeeded: number; failed: number }) => void;
    mockBatchGenerateThumbnails.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      })
    );
    const { POST, DELETE } = await import("./route");

    expect((await POST(postRequest({}))).status).toBe(200);
    expect((await POST(postRequest({}))).status).toBe(409);

    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/admin/thumbnails", {
        method: "DELETE",
        body: JSON.stringify({ clearAll: true }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(deleteResponse.status).toBe(409);

    resolveBatch({ processed: 0, succeeded: 0, failed: 0 });
    await flush();
  });
});
