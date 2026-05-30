import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagCategory } from "@/generated/prisma/client";
import {
  getHomeStats,
  getPopularTags,
  getRandomPosts,
  getRecentImportCount,
  updateHomeStatsCache,
} from "./stats";

const {
  mockSettingsFindUnique,
  mockSettingsUpsert,
  mockPostCount,
  mockPostGroupCount,
  mockTagGroupBy,
  mockTagFindMany,
  mockQueryRaw,
  mockGetPostsByHashRotation,
} = vi.hoisted(() => ({
  mockSettingsFindUnique: vi.fn(),
  mockSettingsUpsert: vi.fn(),
  mockPostCount: vi.fn(),
  mockPostGroupCount: vi.fn(),
  mockTagGroupBy: vi.fn(),
  mockTagFindMany: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockGetPostsByHashRotation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: {
      findUnique: mockSettingsFindUnique,
      upsert: mockSettingsUpsert,
    },
    post: {
      count: mockPostCount,
    },
    group: {
      count: mockPostGroupCount,
    },
    tag: {
      groupBy: mockTagGroupBy,
      findMany: mockTagFindMany,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock("@/lib/random-order", () => ({
  getPostsByHashRotation: mockGetPostsByHashRotation,
}));

function popularTag(category: TagCategory, id: number) {
  return {
    id,
    name: `${category.toLowerCase()}-${id}`,
    category,
    postCount: 100 - id,
  };
}

describe("stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    mockSettingsFindUnique.mockResolvedValue(null);
    mockSettingsUpsert.mockResolvedValue({});
    mockPostCount.mockResolvedValue(12);
    mockPostGroupCount.mockResolvedValue(3);
    mockTagGroupBy.mockResolvedValue([
      { category: TagCategory.ARTIST, _count: { _all: 2 } },
      { category: TagCategory.CHARACTER, _count: { _all: 4 } },
      { category: TagCategory.COPYRIGHT, _count: { _all: 6 } },
      { category: TagCategory.GENERAL, _count: { _all: 8 } },
    ]);
    mockTagFindMany.mockImplementation(({ where }: { where: { category: TagCategory } }) =>
      Promise.resolve([popularTag(where.category, 1), popularTag(where.category, 2)])
    );
    mockQueryRaw.mockResolvedValue([]);
    mockGetPostsByHashRotation.mockResolvedValue([]);
  });

  it("returns cached home stats without recomputing database counts", async () => {
    const cached = {
      totalPosts: 5,
      artistCount: 1,
      characterCount: 2,
      copyrightCount: 3,
      tagCount: 4,
      groupCount: 5,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockSettingsFindUnique.mockResolvedValueOnce({ value: JSON.stringify(cached) });

    await expect(getHomeStats()).resolves.toEqual(cached);
    expect(mockPostCount).not.toHaveBeenCalled();
    expect(mockTagGroupBy).not.toHaveBeenCalled();
    expect(mockSettingsUpsert).not.toHaveBeenCalled();
  });

  it("recomputes and stores home stats when the cached value is invalid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T04:05:06.000Z"));
    mockSettingsFindUnique.mockResolvedValueOnce({ value: "not json" });
    mockTagGroupBy.mockResolvedValueOnce([
      { category: TagCategory.ARTIST, _count: { _all: 2 } },
      { category: TagCategory.GENERAL, _count: { _all: 8 } },
    ]);

    await expect(getHomeStats()).resolves.toEqual({
      totalPosts: 12,
      artistCount: 2,
      characterCount: 0,
      copyrightCount: 0,
      tagCount: 10,
      groupCount: 3,
      updatedAt: "2026-02-03T04:05:06.000Z",
    });
    expect(mockSettingsUpsert).toHaveBeenCalledWith({
      where: { key: "stats.homeStats" },
      update: {
        value: JSON.stringify({
          totalPosts: 12,
          artistCount: 2,
          characterCount: 0,
          copyrightCount: 0,
          tagCount: 10,
          groupCount: 3,
          updatedAt: "2026-02-03T04:05:06.000Z",
        }),
      },
      create: {
        key: "stats.homeStats",
        value: JSON.stringify({
          totalPosts: 12,
          artistCount: 2,
          characterCount: 0,
          copyrightCount: 0,
          tagCount: 10,
          groupCount: 3,
          updatedAt: "2026-02-03T04:05:06.000Z",
        }),
      },
    });
  });

  it("limits cached popular tags per category without querying tag rows", async () => {
    const cached = {
      ARTIST: [popularTag(TagCategory.ARTIST, 1), popularTag(TagCategory.ARTIST, 2)],
      CHARACTER: [popularTag(TagCategory.CHARACTER, 1), popularTag(TagCategory.CHARACTER, 2)],
      COPYRIGHT: [popularTag(TagCategory.COPYRIGHT, 1), popularTag(TagCategory.COPYRIGHT, 2)],
      GENERAL: [popularTag(TagCategory.GENERAL, 1), popularTag(TagCategory.GENERAL, 2)],
    };
    mockSettingsFindUnique.mockResolvedValueOnce({ value: JSON.stringify(cached) });

    await expect(getPopularTags(1)).resolves.toEqual({
      ARTIST: [cached.ARTIST[0]],
      CHARACTER: [cached.CHARACTER[0]],
      COPYRIGHT: [cached.COPYRIGHT[0]],
      GENERAL: [cached.GENERAL[0]],
    });
    expect(mockTagFindMany).not.toHaveBeenCalled();
  });

  it("computes and stores popular tags when the cache is missing", async () => {
    const result = await getPopularTags(1);

    expect(mockTagFindMany).toHaveBeenCalledTimes(4);
    expect(mockTagFindMany).toHaveBeenNthCalledWith(1, {
      where: { category: TagCategory.ARTIST, postCount: { gt: 0 } },
      orderBy: { postCount: "desc" },
      take: 20,
      select: { id: true, name: true, category: true, postCount: true },
    });
    expect(result.ARTIST).toHaveLength(1);
    expect(result.GENERAL).toHaveLength(1);
    expect(mockSettingsUpsert).toHaveBeenCalledWith({
      where: { key: "stats.popularTags" },
      update: expect.objectContaining({ value: expect.any(String) }),
      create: expect.objectContaining({
        key: "stats.popularTags",
        value: expect.any(String),
      }),
    });
  });

  it("refreshes both home stats and popular tag caches together", async () => {
    await updateHomeStatsCache();

    expect(mockSettingsUpsert).toHaveBeenCalledTimes(2);
    expect(mockTagGroupBy).toHaveBeenCalledTimes(1);
    expect(mockTagFindMany).toHaveBeenCalledTimes(4);
  });

  it("queries recent imports using a 24 hour cutoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00.000Z"));

    await getRecentImportCount();

    expect(mockPostCount).toHaveBeenCalledWith({
      where: {
        importedAt: { gte: new Date("2026-03-03T12:00:00.000Z") },
      },
    });
  });

  it("returns random post rows from hash-rotation ordering", async () => {
    const rows = [
      {
        id: 1,
        hash: "abc",
        width: 100,
        height: 200,
        blurhash: null,
        mimeType: "image/jpeg",
      },
    ];
    mockGetPostsByHashRotation.mockResolvedValueOnce(rows);

    await expect(getRandomPosts(6)).resolves.toBe(rows);
    expect(mockGetPostsByHashRotation).toHaveBeenCalledWith({
      page: 1,
      pageSize: 6,
      seed: expect.stringMatching(/^[a-z0-9]{8}$/),
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
