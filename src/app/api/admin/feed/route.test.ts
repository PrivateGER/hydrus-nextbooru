import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyAdminSession: vi.fn(),
  updateFeedSettings: vi.fn(),
  invalidateFeedCache: vi.fn(),
  warmFeedCache: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyAdminSession: mocks.verifyAdminSession }));
vi.mock("@/lib/logger", () => ({ apiLog: { error: vi.fn() } }));
vi.mock("@/lib/feed", () => ({
  invalidateFeedCache: mocks.invalidateFeedCache,
  warmFeedCache: mocks.warmFeedCache,
}));
vi.mock("@/lib/swipes", () => ({ getFeedSwipeStats: vi.fn() }));
vi.mock("@/lib/feed-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feed-settings")>()),
  getFeedSettings: vi.fn(),
  updateFeedSettings: mocks.updateFeedSettings,
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { PUT } from "./route";

const put = (body: unknown) =>
  PUT(new NextRequest("http://localhost/api/admin/feed", { method: "PUT", body: JSON.stringify(body) }));

describe("PUT /api/admin/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdminSession.mockResolvedValue({ authorized: true });
    mocks.updateFeedSettings.mockResolvedValue({ retrieval: "favorites" });
  });

  it("marks the feed stale and starts the rebuild once the change is stored", async () => {
    const response = await put({ retrieval: "favorites" });

    expect(response?.status).toBe(200);
    expect(mocks.updateFeedSettings).toHaveBeenCalledWith({ retrieval: "favorites" });
    expect(mocks.invalidateFeedCache).toHaveBeenCalledTimes(1);
    expect(mocks.warmFeedCache).toHaveBeenCalledTimes(1);
    // Stored first, then invalidated, then rebuilt: a rebuild started earlier would read the old options.
    const order = [mocks.updateFeedSettings, mocks.invalidateFeedCache, mocks.warmFeedCache].map(
      (mock) => mock.mock.invocationCallOrder[0]
    );
    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  it("leaves the feed alone when the change is rejected or cannot be stored", async () => {
    expect((await put({ exploreShare: 9 }))?.status).toBe(400);
    mocks.updateFeedSettings.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await put({ exploreShare: 0.1 }))?.status).toBe(500);

    expect(mocks.invalidateFeedCache).not.toHaveBeenCalled();
    expect(mocks.warmFeedCache).not.toHaveBeenCalled();
  });
});
