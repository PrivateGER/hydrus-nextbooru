import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockAcquire,
  mockRun,
  mockCancel,
  mockStatus,
  mockHealth,
  mockEnabled,
  mockApiLogError,
  mockAiLogInfo,
  mockAiLogError,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockAcquire: vi.fn(),
  mockRun: vi.fn(),
  mockCancel: vi.fn(),
  mockStatus: vi.fn(),
  mockHealth: vi.fn(),
  mockEnabled: vi.fn(),
  mockApiLogError: vi.fn(),
  mockAiLogInfo: vi.fn(),
  mockAiLogError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/ocr", () => ({
  acquireOcrBatchLock: mockAcquire,
  runOcrBatch: mockRun,
  requestOcrBatchCancel: mockCancel,
  getOcrAdminStatus: mockStatus,
  checkOcrServiceHealth: mockHealth,
  isOcrEnabled: mockEnabled,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: mockApiLogError },
  aiLog: { info: mockAiLogInfo, error: mockAiLogError },
}));

import { GET, POST, DELETE } from "./route";

const request = (body?: unknown) =>
  new NextRequest("http://localhost/api/admin/ocr", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdminSession.mockResolvedValue({ authorized: true });
  mockEnabled.mockReturnValue(true);
  mockHealth.mockResolvedValue(true);
  mockStatus.mockResolvedValue({
    pendingImages: 5,
    completeImages: 2,
    failedImages: 1,
    totalRegions: 9,
    batch: { status: "idle", totalPosts: 0, processedPosts: 0, failedPosts: 0, errorMessage: null },
  });
  mockAcquire.mockResolvedValue(true);
  mockRun.mockResolvedValue({ status: "completed", total: 0, processed: 0, failed: 0, errors: [] });
});

describe("GET /api/admin/ocr", () => {
  it("returns stats with enablement and reachability", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(true);
    expect(body.serviceReachable).toBe(true);
    expect(body.pendingImages).toBe(5);
  });
});

describe("POST /api/admin/ocr", () => {
  it("503 when feature disabled", async () => {
    mockEnabled.mockReturnValue(false);
    expect((await POST(request({}))).status).toBe(503);
  });

  it("400 on invalid body types", async () => {
    expect((await POST(request({ limit: "many" }))).status).toBe(400);
    expect((await POST(request({ tags: [1, 2] }))).status).toBe(400);
    expect((await POST(request({ retryFailed: "yes" }))).status).toBe(400);
  });

  it("409 when a batch is already running", async () => {
    mockAcquire.mockResolvedValue(false);
    expect((await POST(request({}))).status).toBe(409);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("202 and starts the batch in the background", async () => {
    const response = await POST(request({ limit: 25, tags: ["comic"], retryFailed: true }));
    expect(response.status).toBe(202);
    expect(mockRun).toHaveBeenCalledWith({ limit: 25, tags: ["comic"], retryFailed: true });
  });

  it("returns the auth response and skips work when not authorized", async () => {
    mockVerifyAdminSession.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const response = await POST(request({ limit: 25 }));
    expect(response.status).toBe(401);
    expect(mockAcquire).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/ocr", () => {
  it("reports whether a batch was cancelled", async () => {
    mockCancel.mockResolvedValue(true);
    const body = await (await DELETE()).json();
    expect(body.cancelled).toBe(true);
  });
});
