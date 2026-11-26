import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPostWithTags } from "../factories";
import { getFeedSettings } from "@/lib/feed-settings";
import { recordFeedSwipe } from "@/lib/swipes";
import { settleFeedRebuild } from "@/lib/feed";

const { verifyAdminSession } = vi.hoisted(() => ({ verifyAdminSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ verifyAdminSession }));

let GET: typeof import("@/app/api/admin/feed/route").GET;
let PUT: typeof import("@/app/api/admin/feed/route").PUT;

function defined<T>(response: T | undefined): T {
  if (!response) throw new Error("route returned no response");
  return response;
}
const get = async () => defined(await GET());
const put = async (body: unknown, raw = false) =>
  defined(
    await PUT(
      new NextRequest("http://localhost/api/admin/feed", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: raw ? (body as string) : JSON.stringify(body),
      })
    )
  );
const storedRows = async () =>
  Object.fromEntries(
    (await getTestPrisma().settings.findMany({ where: { key: { startsWith: "feed." } } })).map((row) => [row.key, row.value])
  );

describe("/api/admin/feed", () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    ({ GET, PUT } = await import("@/app/api/admin/feed/route"));
  });

  afterAll(async () => {
    await settleFeedRebuild();
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await settleFeedRebuild();
    await cleanDatabase();
    verifyAdminSession.mockReset().mockResolvedValue({ authorized: true });
  });

  it("returns the defaults, with swipe results, before anything is saved", async () => {
    const prisma = getTestPrisma();
    const [liked, skipped] = await Promise.all([
      createPostWithTags(prisma, ["explore liked"]),
      createPostWithTags(prisma, ["explore skipped"]),
    ]);
    await recordFeedSwipe(liked.id, "like", true);
    await recordFeedSwipe(skipped.id, "skip", true);

    const response = await get();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings).toEqual({ retrieval: "centroid", diversityLambda: 1, exploreShare: 0, quotaExponent: 1 });
    expect(data.settings).toEqual(data.defaults);
    expect(data.swipes.allTime.explore).toEqual({ liked: 1, skipped: 1, likeRate: 0.5 });
    expect(data.swipes.recent.taste).toEqual({ liked: 0, skipped: 0, likeRate: null });
    expect(data.swipes.recentDays).toBe(7);
  });

  it("saves changes, keeps what was not mentioned, and resets an option with null", async () => {
    const first = await put({ retrieval: "favorites", exploreShare: 0.1, diversityLambda: 0.7 });
    expect(first.status).toBe(200);
    expect((await first.json()).settings).toEqual({
      retrieval: "favorites",
      diversityLambda: 0.7,
      exploreShare: 0.1,
      quotaExponent: 1,
    });
    expect(await storedRows()).toEqual({
      "feed.retrieval": "favorites",
      "feed.exploreShare": "0.1",
      "feed.diversityLambda": "0.7",
    });

    const second = await put({ exploreShare: null, quotaExponent: 0.5 });
    expect(second.status).toBe(200);
    expect(await storedRows()).toEqual({
      "feed.retrieval": "favorites",
      "feed.diversityLambda": "0.7",
      "feed.quotaExponent": "0.5",
    });
    expect(await getFeedSettings()).toEqual({
      retrieval: "favorites",
      diversityLambda: 0.7,
      exploreShare: 0,
      quotaExponent: 0.5,
    });
    expect((await (await get()).json()).settings.quotaExponent).toBe(0.5);
  });

  it("rejects invalid input without changing anything", async () => {
    await put({ exploreShare: 0.2 });
    const cases: Array<[unknown, boolean]> = [
      ["{not json", true],
      [{}, false],
      [{ exploreShare: 0.9 }, false],
      [{ retrieval: "interests" }, false],
      [{ nope: 1 }, false],
      // A valid value next to an invalid one is not saved either.
      [{ quotaExponent: 0.5, exploreShare: "lots" }, false],
    ];
    for (const [body, raw] of cases) {
      expect((await put(body, raw)).status).toBe(400);
    }
    expect(await storedRows()).toEqual({ "feed.exploreShare": "0.2" });
  });

  it("refuses requests without an admin session", async () => {
    verifyAdminSession.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await get()).status).toBe(401);
    expect((await put({ exploreShare: 0.2 })).status).toBe(401);
    expect(await storedRows()).toEqual({});
  });
});
