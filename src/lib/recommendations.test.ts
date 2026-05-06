import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RECOMMENDATION_LIMIT,
  computeRecommendationsForPost,
  getOrComputeRecommendations,
  getOrComputeRecommendationsByHash,
  getRecommendationStats,
  hasRecommendations,
  invalidateAllRecommendations,
  invalidateRecommendationsForPost,
} from "./recommendations";

const {
  mockPostRecommendationFindMany,
  mockPostRecommendationDeleteMany,
  mockPostRecommendationCreateMany,
  mockPostRecommendationCount,
  mockPostFindUnique,
  mockPostFindMany,
  mockQueryRaw,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPostRecommendationFindMany: vi.fn(),
  mockPostRecommendationDeleteMany: vi.fn(),
  mockPostRecommendationCreateMany: vi.fn(),
  mockPostRecommendationCount: vi.fn(),
  mockPostFindUnique: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    postRecommendation: {
      findMany: mockPostRecommendationFindMany,
      deleteMany: mockPostRecommendationDeleteMany,
      createMany: mockPostRecommendationCreateMany,
      count: mockPostRecommendationCount,
    },
    post: {
      findUnique: mockPostFindUnique,
      findMany: mockPostFindMany,
    },
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  },
}));

function recommended(id: number, score: number, computedAt = new Date()) {
  return {
    recommended: {
      id,
      hash: `hash-${id}`,
      width: 100 + id,
      height: 200 + id,
      blurhash: null,
      mimeType: "image/jpeg",
    },
    score,
    computedAt,
  };
}

describe("recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    mockPostRecommendationFindMany.mockResolvedValue([]);
    mockPostRecommendationDeleteMany.mockResolvedValue({ count: 0 });
    mockPostRecommendationCreateMany.mockResolvedValue({ count: 0 });
    mockPostRecommendationCount.mockResolvedValue(0);
    mockPostFindUnique.mockResolvedValue(null);
    mockPostFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    mockTransaction.mockImplementation(async (callback: (tx: {
      postRecommendation: {
        deleteMany: typeof mockPostRecommendationDeleteMany;
        createMany: typeof mockPostRecommendationCreateMany;
      };
    }) => Promise<void>) =>
      callback({
        postRecommendation: {
          deleteMany: mockPostRecommendationDeleteMany,
          createMany: mockPostRecommendationCreateMany,
        },
      })
    );
  });

  it("returns fresh cached recommendations with clamped limits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    mockPostRecommendationFindMany.mockResolvedValueOnce([
      recommended(1, 0.9, new Date("2026-01-01T12:00:00.000Z")),
      recommended(2, 0.8, new Date("2026-01-01T12:00:00.000Z")),
    ]);

    await expect(getOrComputeRecommendations(10, 1.8)).resolves.toEqual([
      {
        id: 1,
        hash: "hash-1",
        width: 101,
        height: 201,
        blurhash: null,
        mimeType: "image/jpeg",
        score: 0.9,
      },
    ]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockPostRecommendationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId: 10 },
        orderBy: { score: "desc" },
        take: MAX_RECOMMENDATION_LIMIT,
      })
    );
  });

  it("treats missing computedAt cache rows as stale and replaces them with fresh results", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    mockPostRecommendationFindMany.mockResolvedValueOnce([recommended(1, 0.9, null as unknown as Date)]);
    mockQueryRaw.mockResolvedValueOnce([
      { recommended_id: 3, score: 0.7 },
      { recommended_id: 4, score: 0.6 },
    ]);
    mockPostFindMany.mockResolvedValueOnce([
      {
        id: 3,
        hash: "hash-3",
        width: 103,
        height: 203,
        blurhash: "blur",
        mimeType: "image/png",
      },
    ]);

    await expect(getOrComputeRecommendations(10, 20)).resolves.toEqual([
      {
        id: 3,
        hash: "hash-3",
        width: 103,
        height: 203,
        blurhash: "blur",
        mimeType: "image/png",
        score: 0.7,
      },
    ]);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockPostRecommendationDeleteMany).toHaveBeenCalledWith({ where: { postId: 10 } });
    expect(mockPostRecommendationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          postId: 10,
          recommendedId: 3,
          score: 0.7,
          computedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          postId: 10,
          recommendedId: 4,
          score: 0.6,
          computedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      skipDuplicates: true,
    });
  });

  it("deletes stale cache rows when recomputation returns no recommendations", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    await expect(getOrComputeRecommendations(10, Number.NaN)).resolves.toEqual([]);
    expect(mockPostRecommendationDeleteMany).toHaveBeenCalledWith({ where: { postId: 10 } });
  });

  it("looks up recommendations by hash and returns empty for missing posts", async () => {
    await expect(getOrComputeRecommendationsByHash("missing")).resolves.toEqual([]);
    expect(mockPostRecommendationFindMany).not.toHaveBeenCalled();

    mockPostFindUnique.mockResolvedValueOnce({ id: 12 });
    mockQueryRaw.mockResolvedValueOnce([]);

    await expect(getOrComputeRecommendationsByHash("present", 5)).resolves.toEqual([]);
    expect(mockPostFindUnique).toHaveBeenCalledWith({
      where: { hash: "present" },
      select: { id: true },
    });
    expect(mockPostRecommendationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: 12 } })
    );
  });

  it("maps uncached SQL recommendation rows to public IDs and scores", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { recommended_id: 7, score: 0.55 },
      { recommended_id: 8, score: 0.45 },
    ]);

    await expect(computeRecommendationsForPost(10, 2)).resolves.toEqual([
      { recommendedId: 7, score: 0.55 },
      { recommendedId: 8, score: 0.45 },
    ]);
  });

  it("invalidates recommendations touching a post and can invalidate all rows", async () => {
    const client = {
      postRecommendation: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await invalidateRecommendationsForPost(5, client);
    expect(client.postRecommendation.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ postId: 5 }, { recommendedId: 5 }],
      },
    });

    await invalidateAllRecommendations(client);
    expect(client.postRecommendation.deleteMany).toHaveBeenLastCalledWith();
  });

  it("reports recommendation presence and aggregate stats", async () => {
    mockPostRecommendationCount.mockResolvedValueOnce(1);
    await expect(hasRecommendations()).resolves.toBe(true);
    expect(mockPostRecommendationCount).toHaveBeenCalledWith({ take: 1 });

    mockPostRecommendationCount.mockResolvedValueOnce(12);
    mockQueryRaw.mockResolvedValueOnce([{ count: 3n }]);

    await expect(getRecommendationStats()).resolves.toEqual({
      totalRecommendations: 12,
      postsWithRecommendations: 3,
    });
  });
});
