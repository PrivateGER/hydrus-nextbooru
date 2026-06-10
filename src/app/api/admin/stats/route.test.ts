import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockExecuteRaw,
  mockPostCount,
  mockSettingsUpsert,
  mockUpdateHomeStatsCache,
  mockInvalidateAllCaches,
  mockVerifyAdminSession,
  mockApiLogError,
} = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockPostCount: vi.fn(),
  mockSettingsUpsert: vi.fn(),
  mockUpdateHomeStatsCache: vi.fn(),
  mockInvalidateAllCaches: vi.fn(),
  mockVerifyAdminSession: vi.fn(),
  mockApiLogError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $executeRaw: mockExecuteRaw,
    post: {
      count: mockPostCount,
    },
    settings: {
      upsert: mockSettingsUpsert,
    },
  },
}));

vi.mock("@/lib/stats", () => ({
  updateHomeStatsCache: mockUpdateHomeStatsCache,
}));

vi.mock("@/lib/cache", () => ({
  invalidateAllCaches: mockInvalidateAllCaches,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: {
    error: mockApiLogError,
  },
}));

describe("POST /api/admin/stats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockExecuteRaw.mockResolvedValue(0);
    mockPostCount.mockResolvedValue(42);
    mockSettingsUpsert.mockResolvedValue({});
    mockUpdateHomeStatsCache.mockResolvedValue(undefined);
  });

  it("returns the auth response without touching stats when unauthorized", async () => {
    mockVerifyAdminSession.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("./route");
    const response = await POST();

    expect(response.status).toBe(401);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockPostCount).not.toHaveBeenCalled();
    expect(mockUpdateHomeStatsCache).not.toHaveBeenCalled();
    expect(mockInvalidateAllCaches).not.toHaveBeenCalled();
  });

  it("recalculates tag counts, stores total post count, refreshes stats, and invalidates caches", async () => {
    const { POST } = await import("./route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "All stats recalculated successfully",
    });
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockPostCount).toHaveBeenCalledTimes(1);
    expect(mockSettingsUpsert).toHaveBeenCalledWith({
      where: { key: "stats.totalPostCount" },
      update: { value: "42" },
      create: { key: "stats.totalPostCount", value: "42" },
    });
    expect(mockUpdateHomeStatsCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateAllCaches).toHaveBeenCalledTimes(1);
  });

  it("logs the real failure server-side but returns a generic error without invalidating caches", async () => {
    mockUpdateHomeStatsCache.mockRejectedValueOnce(new Error("stats cache unavailable"));

    const { POST } = await import("./route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    // The raw error message must NOT leak to the client.
    expect(body).toEqual({ error: "Internal server error" });
    expect(body.error).not.toContain("stats cache unavailable");
    // ...but it is still logged server-side for diagnosis.
    expect(mockApiLogError).toHaveBeenCalledWith(
      { error: "stats cache unavailable" },
      "Failed to recalculate stats"
    );
    expect(mockInvalidateAllCaches).not.toHaveBeenCalled();
  });
});
