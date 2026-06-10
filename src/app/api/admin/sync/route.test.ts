import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSyncState,
  mockSyncFromHydrus,
  mockAcquireSyncLock,
  mockVerifyAdminSession,
  mockSyncUpdateMany,
  mockApiLogError,
  mockSyncLogInfo,
  mockSyncLogError,
} = vi.hoisted(() => ({
  mockGetSyncState: vi.fn(),
  mockSyncFromHydrus: vi.fn(),
  mockAcquireSyncLock: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
  mockSyncUpdateMany: vi.fn(),
  mockApiLogError: vi.fn(),
  mockSyncLogInfo: vi.fn(),
  mockSyncLogError: vi.fn(),
}));

vi.mock("@/lib/hydrus", () => ({
  getSyncState: mockGetSyncState,
}));

vi.mock("@/lib/hydrus/sync", () => ({
  syncFromHydrus: mockSyncFromHydrus,
  acquireSyncLock: mockAcquireSyncLock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    syncState: { updateMany: mockSyncUpdateMany },
  },
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: mockApiLogError },
  syncLog: { info: mockSyncLogInfo, error: mockSyncLogError },
}));

function makeRequest(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as import("next/server").NextRequest;
}

describe("POST /api/admin/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    // Never resolve the background sync within the test window.
    mockSyncFromHydrus.mockReturnValue(new Promise(() => {}));
  });

  it("starts the sync when the lock is acquired and passes lockAlreadyHeld", async () => {
    mockAcquireSyncLock.mockResolvedValue(true);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ tags: ["artist:alice"] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tags).toEqual(["artist:alice"]);
    expect(mockAcquireSyncLock).toHaveBeenCalledTimes(1);
    expect(mockSyncFromHydrus).toHaveBeenCalledWith({ tags: ["artist:alice"], lockAlreadyHeld: true });
  });

  it("returns 409 without starting a sync when the lock is already held", async () => {
    mockAcquireSyncLock.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(409);
    expect(mockSyncFromHydrus).not.toHaveBeenCalled();
  });

  it("decides the 409 by the atomic lock, not a prior read of sync state", async () => {
    // getSyncState (the racy read) is irrelevant to the POST decision now.
    mockAcquireSyncLock.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(409);
    expect(mockGetSyncState).not.toHaveBeenCalled();
  });

  it("simulates a concurrent start: only the lock winner starts the sync", async () => {
    // Two concurrent POSTs; the DB write decides a single winner.
    mockAcquireSyncLock
      .mockResolvedValueOnce(true)   // first caller wins
      .mockResolvedValueOnce(false); // second caller loses

    const { POST } = await import("./route");
    const [first, second] = await Promise.all([
      POST(makeRequest({})),
      POST(makeRequest({})),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(mockSyncFromHydrus).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-array tags field with 400 and does not acquire the lock", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ tags: "artist:alice" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/tags must be an array of strings/);
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
    expect(mockSyncFromHydrus).not.toHaveBeenCalled();
  });

  it("rejects a tags array containing non-strings with 400", async () => {
    mockAcquireSyncLock.mockResolvedValue(true);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ tags: ["ok", 42, { nested: true }] }));

    expect(res.status).toBe(400);
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  it("defaults to system:everything when tags is omitted", async () => {
    mockAcquireSyncLock.mockResolvedValue(true);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tags).toEqual(["system:everything"]);
    expect(mockSyncFromHydrus).toHaveBeenCalledWith({ tags: undefined, lockAlreadyHeld: true });
  });
});
