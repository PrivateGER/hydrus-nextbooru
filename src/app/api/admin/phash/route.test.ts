import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockBatchComputePhashes,
  mockGetPhashStats,
  mockDeleteMany,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockBatchComputePhashes: vi.fn(),
  mockGetPhashStats: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    phashEntry: { deleteMany: mockDeleteMany },
  },
}));

vi.mock("@/lib/phash", () => ({
  getPhashStats: mockGetPhashStats,
  batchComputePhashes: mockBatchComputePhashes,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: vi.fn() },
  phashLog: { info: vi.fn(), error: vi.fn() },
}));

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/phash", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function deleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/phash", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("admin phash route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockGetPhashStats.mockResolvedValue({ total: 5, withPhash: 3, withoutPhash: 2, unsupported: 0 });
  });

  it("GET merges stats with the batch snapshot", async () => {
    const { GET } = await import("./route");
    const data = await (await GET()).json();

    expect(data).toMatchObject({
      total: 5,
      withPhash: 3,
      batchRunning: false,
      batchStatus: "idle",
      batchError: null,
    });
    expect(data.batchProgress).toBeNull();
  });

  it("POST starts a batch and reports completion in the snapshot", async () => {
    mockBatchComputePhashes.mockResolvedValueOnce({ processed: 4, succeeded: 4, failed: 0 });
    const { GET, POST } = await import("./route");

    const response = await POST(postRequest({ limit: 0, batchSize: 10 }));
    const body = await response.json();
    expect(response.status).toBe(200);
    // Explicit limit 0 must not be reported as "unlimited".
    expect(body.limit).toBe(0);

    await flush();
    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("completed");
  });

  it("POST reports a failed batch with its error", async () => {
    mockBatchComputePhashes.mockRejectedValueOnce(new Error("phash boom"));
    const { GET, POST } = await import("./route");

    await POST(postRequest({}));
    await flush();

    const data = await (await GET()).json();
    expect(data.batchStatus).toBe("failed");
    expect(data.batchError).toBe("phash boom");
  });

  it.each([
    ["batchSize is zero", { batchSize: 0 }],
    ["batchSize is fractional", { batchSize: 2.5 }],
    ["limit is negative", { limit: -1 }],
  ])("POST rejects invalid input when %s", async (_label, body) => {
    const { POST } = await import("./route");
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    expect(mockBatchComputePhashes).not.toHaveBeenCalled();
  });

  it("POST and reset DELETE return 409 while a batch is running", async () => {
    let resolveBatch!: (value: { processed: number; succeeded: number; failed: number }) => void;
    mockBatchComputePhashes.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      })
    );
    const { POST, DELETE } = await import("./route");

    expect((await POST(postRequest({}))).status).toBe(200);
    expect((await POST(postRequest({}))).status).toBe(409);
    expect((await DELETE(deleteRequest({ resetAll: true }))).status).toBe(409);

    resolveBatch({ processed: 0, succeeded: 0, failed: 0 });
    await flush();
  });

  it("DELETE resets phash entries when idle", async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 7 });
    const { DELETE } = await import("./route");

    const response = await DELETE(deleteRequest({ resetAll: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(7);
  });

  it("DELETE without an action returns 400", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(deleteRequest({}))).status).toBe(400);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});
