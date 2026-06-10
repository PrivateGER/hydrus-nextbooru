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
