import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "./feed";

const { mockQueryRaw, mockGetFeedPage } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetFeedPage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw } }));
vi.mock("@/lib/feed", () => ({
  FEED_CONFIG: { maxFeedSize: 528 },
  getFeedPage: mockGetFeedPage,
}));

import {
  DECK_TAGS_PER_CATEGORY,
  getFeedDeck,
  parseExcludeList,
  selectDeckCandidates,
} from "./feed-deck";

const hash = (n: number) => n.toString(16).padStart(64, "0");

function feedPost(id: number): FeedPost {
  return {
    id,
    hash: hash(id),
    width: 100,
    height: 200,
    blurhash: null,
    mimeType: "image/png",
    score: 1 / id,
  };
}

function detailRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    extension: ".png",
    duration: null,
    hasAudio: false,
    artists: [],
    characters: [],
    copyrights: [],
    ...overrides,
  };
}

describe("parseExcludeList", () => {
  it("keeps valid hashes, lowercased and deduped", () => {
    const upper = hash(10).toUpperCase();
    const result = parseExcludeList([hash(1), hash(1), "ABCDEF".padStart(64, "0"), upper]);
    expect([...result]).toEqual([hash(1), "abcdef".padStart(64, "0"), hash(10)]);
  });

  it("drops malformed entries instead of failing", () => {
    const result = parseExcludeList([hash(1), "nope", 42, null, { hash: hash(2) }, `${hash(3)}x`]);
    expect([...result]).toEqual([hash(1)]);
  });

  it("treats non-arrays as empty and honors the cap", () => {
    expect(parseExcludeList("abc").size).toBe(0);
    expect(parseExcludeList(undefined).size).toBe(0);
    expect(parseExcludeList([hash(1), hash(2), hash(3)], 2).size).toBe(2);
  });
});

describe("selectDeckCandidates", () => {
  const feed = [1, 2, 3, 4, 5].map(feedPost);

  it("returns the top unseen posts in rank order", () => {
    const { picked, unseen } = selectDeckCandidates(feed, new Set([hash(1), hash(3)]), 2);
    expect(picked.map((p) => p.id)).toEqual([2, 4]);
    expect(unseen).toBe(3);
  });

  it("reports nothing left once everything has been seen", () => {
    const { picked, unseen } = selectDeckCandidates(feed, new Set(feed.map((p) => p.hash)), 10);
    expect(picked).toEqual([]);
    expect(unseen).toBe(0);
  });
});

describe("getFeedDeck", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockGetFeedPage.mockReset();
  });

  it("enriches the batch in one query and reports what is left", async () => {
    const feed = [1, 2, 3, 4].map(feedPost);
    mockGetFeedPage.mockResolvedValue({ posts: feed, totalCount: 4, totalPages: 1 });
    mockQueryRaw.mockResolvedValue([
      detailRow(3, { extension: ".mp4", duration: 4200, hasAudio: true }),
      detailRow(2, { artists: ["a1", "a2", "a3", "a4"], characters: ["c_1"], copyrights: ["x"] }),
    ]);

    const result = await getFeedDeck(new Set([hash(1)]), 2);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBe(4);
    expect(result.remaining).toBe(1);
    // Rank order survives regardless of SQL row order.
    expect(result.posts.map((p) => p.id)).toEqual([2, 3]);
    expect(result.posts[0].artists).toHaveLength(DECK_TAGS_PER_CATEGORY);
    expect(result.posts[0].characters).toEqual(["c_1"]);
    expect(result.posts[1]).toMatchObject({ extension: ".mp4", duration: 4200, hasAudio: true });
    expect(result.posts[0]).not.toHaveProperty("score");
  });

  it("skips posts deleted since the ranking was cached", async () => {
    mockGetFeedPage.mockResolvedValue({ posts: [1, 2].map(feedPost), totalCount: 2, totalPages: 1 });
    mockQueryRaw.mockResolvedValue([detailRow(2)]);

    const result = await getFeedDeck(new Set(), 10);
    expect(result.posts.map((p) => p.id)).toEqual([2]);
  });

  it("does not query when nothing is left", async () => {
    mockGetFeedPage.mockResolvedValue({ posts: [feedPost(1)], totalCount: 1, totalPages: 1 });

    const result = await getFeedDeck(new Set([hash(1)]), 10);
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [], remaining: 0, totalCount: 1 });
  });
});
