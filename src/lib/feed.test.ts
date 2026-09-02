import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";

const mocks = vi.hoisted(() => ({
  vectors: vi.fn(),
  nearest: vi.fn(),
  maxSimilarity: vi.fn(),
  tagNeighborhoods: vi.fn(),
  favoriteFindMany: vi.fn(),
  dismissalFindMany: vi.fn(),
  viewFindMany: vi.fn(),
  postGroupFindMany: vi.fn(),
  postFindMany: vi.fn(),
  settings: vi.fn(),
  providerConfigured: vi.fn(),
  toConfig: vi.fn(),
  baseline: vi.fn(),
  calibrate: vi.fn((score: number, baseline: number) =>
    Math.max(0, Math.min(1, (score - baseline) / (1 - baseline)))
  ),
}));

vi.mock("@/lib/embeddings/store", () => ({
  getEmbeddingVectorsForPosts: mocks.vectors,
  findNearestByVector: mocks.nearest,
  getMaxSimilarityToReferences: mocks.maxSimilarity,
}));
vi.mock("@/lib/recommendations", () => ({
  getTagNeighborhoodsForSeeds: mocks.tagNeighborhoods,
}));
vi.mock("@/lib/embeddings/settings", () => ({
  getEmbeddingOpenRouterSettings: mocks.settings,
  isEmbeddingProviderConfigured: mocks.providerConfigured,
  toEmbeddingConfig: mocks.toConfig,
}));
vi.mock("@/lib/embeddings/calibration", () => ({
  getEmbeddingBaseline: mocks.baseline,
  calibrateEmbeddingScore: mocks.calibrate,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    favorite: { findMany: mocks.favoriteFindMany },
    feedDismissal: { findMany: mocks.dismissalFindMany },
    postView: { findMany: mocks.viewFindMany },
    postGroup: { findMany: mocks.postGroupFindMany },
    post: { findMany: mocks.postFindMany },
  },
}));

import * as taste from "@/lib/taste";
import {
  FEED_CONFIG,
  buildFeed,
  clearFeedCache,
  applyFreshnessBoost,
  applyViewedPenalty,
  collapseSignalsByGroup,
  dedupeRankedByBlurhash,
  dedupeRankedByGroup,
  feedRebuildInFlight,
  getFeedPage,
  invalidateFeedCache,
  mergeSeedCandidates,
  seedWeight,
  selectViewSeeds,
  settleFeedRebuild,
  type FeedConfig,
  type FeedPost,
} from "./feed";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-09-02T12:00:00.000Z");
const EMBEDDING_CONFIG: EmbeddingConfig = {
  baseUrl: "https://embedding.test/v1",
  model: "test-model",
  dimensions: 4,
  imageMaxResolution: 1024,
};
const TEST_CONFIG: FeedConfig = {
  ...FEED_CONFIG,
  clusterCount: 2,
  minClusterSize: 1,
  clusterIterations: 10,
  neighborsPerCluster: 20,
  pageSize: 4,
  pageCount: 2,
  maxFeedSize: 8,
  freshnessBoost: 0,
  viewedCandidatePenaltyFloor: 1,
};

function hash(id: number): string {
  return id.toString(16).padStart(64, "0");
}

function favorite(postId: number, ageDays = 0) {
  return {
    postId,
    favoritedAt: new Date(NOW.getTime() - ageDays * DAY_MS),
    post: { hash: hash(postId) },
  };
}

function card(id: number) {
  return {
    id,
    hash: hash(id),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    importedAt: NOW,
  };
}

function recommendation(id: number, score: number) {
  return {
    id,
    hash: hash(id),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    score,
  };
}

function ranked(id: number, score: number, blurhash: string | null = null): FeedPost {
  return {
    id,
    hash: hash(id),
    width: 100,
    height: 100,
    blurhash,
    mimeType: "image/png",
    score,
  };
}

beforeEach(async () => {
  await settleFeedRebuild();
  clearFeedCache();
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.settings.mockResolvedValue({});
  mocks.providerConfigured.mockReturnValue(true);
  mocks.toConfig.mockReturnValue(EMBEDDING_CONFIG);
  mocks.baseline.mockResolvedValue(0);
  mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2)]);
  mocks.dismissalFindMany.mockResolvedValue([]);
  mocks.viewFindMany.mockImplementation((args: { select?: { post?: boolean } }) =>
    Promise.resolve(args.select?.post ? [] : [])
  );
  mocks.postGroupFindMany.mockResolvedValue([]);
  mocks.vectors.mockImplementation(({ postIds }: { postIds: number[] }) =>
    Promise.resolve(
      postIds.map((postId) => ({
        postId,
        vector: new Float32Array(postId % 2 === 0 ? [0, 1, 0, 0] : [1, 0, 0, 0]),
      }))
    )
  );
  mocks.nearest.mockResolvedValue([{ postId: 10, score: 0.9 }]);
  mocks.maxSimilarity.mockImplementation(
    ({ candidateIds }: { candidateIds: number[] }) =>
      Promise.resolve(new Map(candidateIds.map((id) => [id, 0.9])))
  );
  mocks.postFindMany.mockImplementation(({ where }: { where: { id: { in: number[] } } }) =>
    Promise.resolve(where.id.in.map(card))
  );
  mocks.tagNeighborhoods.mockResolvedValue(new Map());
});

describe("taste members", () => {
  it("collapses favorites before views with one shared seen-set and preserves weights", () => {
    const groups = new Map<number, number[]>([
      [1, [7]],
      [2, [7]],
      [3, [8]],
      [4, [8]],
    ]);
    const seen = new Set<number>();
    const favorites = collapseSignalsByGroup(
      [
        { postId: 1, at: NOW },
        { postId: 2, at: new Date(NOW.getTime() - DAY_MS) },
      ],
      groups,
      seen
    );
    const views = collapseSignalsByGroup(
      [
        { postId: 2, hash: hash(2), viewCount: 8, lastViewedAt: NOW },
        { postId: 3, hash: hash(3), viewCount: 8, lastViewedAt: NOW },
        { postId: 4, hash: hash(4), viewCount: 8, lastViewedAt: NOW },
      ],
      groups,
      seen
    );
    const viewSeeds = selectViewSeeds(views, NOW, TEST_CONFIG);

    expect(favorites.map((signal) => signal.postId)).toEqual([1]);
    expect(views.map((signal) => signal.postId)).toEqual([3]);
    expect(seedWeight(new Date(NOW.getTime() - 90 * DAY_MS), NOW, 90)).toBeCloseTo(0.5);
    expect(viewSeeds[0].weight).toBeCloseTo(TEST_CONFIG.viewWeightCap);
  });
});

describe("tag-only fallback merge", () => {
  it("adds seed.weight * tag cosine linearly and honors exclusions", () => {
    const merged = mergeSeedCandidates(
      [
        {
          seed: { postId: 1, hash: hash(1), weight: 0.5 },
          idf: [recommendation(10, 0.8), recommendation(11, 1)],
        },
        {
          seed: { postId: 2, hash: hash(2), weight: 0.25 },
          idf: [recommendation(10, 0.4), recommendation(12, 1)],
        },
      ],
      new Set([11])
    );

    expect(merged.map((post) => post.id)).toEqual([10, 12]);
    expect(merged[0].score).toBeCloseTo(0.5);
    expect(merged[1].score).toBeCloseTo(0.25);
  });
});

describe("taste-cluster build", () => {
  it("fetches only missing member vectors, invalidates on config identity, and warm-starts", async () => {
    const fitSpy = vi.spyOn(taste, "fitTasteModel");
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);

    await buildFeed({ ...TEST_CONFIG, clusterCount: 1 });
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [1],
      config: EMBEDDING_CONFIG,
    });

    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2)]);
    await buildFeed({ ...TEST_CONFIG, clusterCount: 1 });
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [2],
      config: EMBEDDING_CONFIG,
    });
    expect(fitSpy.mock.calls[1][5]).toBeInstanceOf(Float32Array);

    const switched = { ...EMBEDDING_CONFIG, model: "other-model" };
    mocks.toConfig.mockReturnValue(switched);
    await buildFeed({ ...TEST_CONFIG, clusterCount: 1 });
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [1, 2],
      config: switched,
    });
    expect(fitSpy.mock.calls[2][5]).toBeNull();

    clearFeedCache();
    await buildFeed({ ...TEST_CONFIG, clusterCount: 1 });
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [1, 2],
      config: switched,
    });
    expect(fitSpy.mock.calls[3][5]).toBeNull();
    fitSpy.mockRestore();
  });

  it("caps taste members and evicts stale vectors after a favorite is removed", async () => {
    const fitSpy = vi.spyOn(taste, "fitTasteModel");
    const config = { ...TEST_CONFIG, clusterCount: 1, maxTasteMembers: 2 };
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2),
      favorite(3),
    ]);

    await buildFeed(config);
    expect(fitSpy.mock.calls[0][0].map((member) => member.postId)).toEqual([1, 2]);
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [1, 2],
      config: EMBEDDING_CONFIG,
    });

    mocks.favoriteFindMany.mockResolvedValue([favorite(2), favorite(3)]);
    await buildFeed(config);
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [3],
      config: EMBEDDING_CONFIG,
    });

    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2)]);
    await buildFeed(config);
    expect(mocks.vectors).toHaveBeenLastCalledWith({
      postIds: [1],
      config: EMBEDDING_CONFIG,
    });
    fitSpy.mockRestore();
  });

  it("reuses centroids after a min-size merge reduces the fitted cluster count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fitSpy = vi.spyOn(taste, "fitTasteModel");
    mocks.favoriteFindMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => favorite(index + 1))
    );
    const rows = [
      [1, 0, 0, 0],
      [1, 0.04, 0, 0],
      [1, -0.04, 0, 0],
      [0, 1, 0, 0],
      [0.04, 1, 0, 0],
      [-0.04, 1, 0, 0],
      [0.8, 0, 0.6, 0],
    ];
    mocks.vectors.mockResolvedValue(
      rows.map((vector, index) => ({
        postId: index + 1,
        vector: new Float32Array(vector),
      }))
    );
    const config = {
      ...TEST_CONFIG,
      clusterCount: 3,
      minClusterSize: 3,
    };

    await buildFeed(config);
    const firstModel = fitSpy.mock.results[0].value;
    expect(firstModel.clusters).toHaveLength(2);

    await buildFeed(config);
    const warmStart = fitSpy.mock.calls[1][5];
    expect(warmStart).toBeInstanceOf(Float32Array);
    expect(warmStart).toHaveLength(2 * EMBEDDING_CONFIG.dimensions);
    expect(Array.from(warmStart as Float32Array)).toEqual(
      firstModel.clusters.flatMap((cluster) => Array.from(cluster.centroid))
    );
    fitSpy.mockRestore();
  });

  it("calibrates, floors, excludes, gates, filters dismissals, and allocates clusters", async () => {
    mocks.dismissalFindMany.mockResolvedValue([{ postId: 9 }]);
    mocks.postGroupFindMany.mockImplementation(
      (args: { where?: { group?: unknown; postId?: { in: number[] } } }) => {
        if (args.where?.group) return Promise.resolve([{ postId: 99 }]);
        return Promise.resolve([]);
      }
    );
    let annCall = 0;
    mocks.nearest.mockImplementation(() => {
      const base = annCall++ === 0 ? 100 : 200;
      return Promise.resolve([
        { postId: 1, score: 0.99 },
        { postId: 9, score: 0.99 },
        { postId: 99, score: 0.99 },
        { postId: base + 1, score: 0.9 },
        { postId: base + 2, score: 0.8 },
        { postId: base + 3, score: 0.2 },
        { postId: base + 4, score: 0.7 },
      ]);
    });
    mocks.maxSimilarity.mockImplementation(
      ({ candidateIds, referenceIds }: { candidateIds: number[]; referenceIds: number[] }) => {
        if (referenceIds.includes(9)) {
          return Promise.resolve(
            new Map(candidateIds.map((id) => [id, id === 101 ? 0.7 : 0.1]))
          );
        }
        return Promise.resolve(
          new Map(candidateIds.map((id) => [id, id % 100 === 2 ? 0.1 : 0.5]))
        );
      }
    );

    const feed = await buildFeed(TEST_CONFIG);
    const ids = feed.map((post) => post.id);

    expect(ids).toEqual([104, 201, 204]);
    expect(ids).not.toEqual(expect.arrayContaining([1, 9, 99, 101, 102, 103, 202, 203]));
    expect(mocks.nearest).toHaveBeenCalledTimes(2);
    expect(mocks.maxSimilarity).toHaveBeenCalledTimes(3);
    expect(mocks.postFindMany).toHaveBeenCalledTimes(1);
  });

  it("uses the tag fallback only when embeddings are unconfigured", async () => {
    mocks.providerConfigured.mockReturnValue(false);
    mocks.tagNeighborhoods.mockResolvedValue(
      new Map([
        [1, [recommendation(30, 0.8)]],
        [2, [recommendation(31, 0.7)]],
      ])
    );

    const feed = await buildFeed(TEST_CONFIG);

    expect(feed.map((post) => post.id)).toEqual([30, 31]);
    expect(mocks.tagNeighborhoods).toHaveBeenCalledWith([1, 2], 20);
    expect(mocks.vectors).not.toHaveBeenCalled();
    expect(mocks.nearest).not.toHaveBeenCalled();
  });
});

describe("stale-while-revalidate degradation", () => {
  it("retains a stale entry when the embedding store rejects", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2), favorite(3)]);
    mocks.vectors.mockResolvedValue([
      { postId: 1, vector: new Float32Array([1, 0, 0, 0]) },
      { postId: 2, vector: new Float32Array([1, 0, 0, 0]) },
      { postId: 3, vector: new Float32Array([1, 0, 0, 0]) },
    ]);
    mocks.nearest.mockResolvedValue([{ postId: 10, score: 0.9 }]);

    const initial = await getFeedPage(1, 48);
    expect(initial.posts.map((post: FeedPost) => post.id)).toEqual([10]);

    invalidateFeedCache();
    mocks.nearest.mockRejectedValueOnce(new Error("ANN unavailable"));
    const stale = await getFeedPage(1, 48);

    expect(stale.posts.map((post: FeedPost) => post.id)).toEqual([10]);
    expect(feedRebuildInFlight()).toBe(true);
    await settleFeedRebuild();

    mocks.nearest.mockRejectedValueOnce(new Error("still unavailable"));
    const retained = await getFeedPage(1, 48);
    expect(retained.posts.map((post: FeedPost) => post.id)).toEqual([10]);
    await settleFeedRebuild();
  });
});

describe("signal weighting", () => {
  it("clamps future timestamps and halves weight at the configured half-life", () => {
    expect(seedWeight(new Date(NOW.getTime() + DAY_MS), NOW, 90)).toBe(1);
    expect(seedWeight(new Date(NOW.getTime() - 90 * DAY_MS), NOW, 90)).toBeCloseTo(0.5);
  });

  it("caps view count, decays recency, and respects the view member limit", () => {
    const config = { ...TEST_CONFIG, viewSeedCount: 2 };
    const seeds = selectViewSeeds(
      [
        { postId: 1, hash: hash(1), viewCount: 1, lastViewedAt: NOW },
        {
          postId: 2,
          hash: hash(2),
          viewCount: 80,
          lastViewedAt: new Date(NOW.getTime() - 30 * DAY_MS),
        },
        { postId: 3, hash: hash(3), viewCount: 80, lastViewedAt: NOW },
      ],
      NOW,
      config
    );
    expect(seeds.map((seed) => seed.postId)).toEqual([1, 2]);
    expect(seeds[0].weight).toBeLessThan(config.viewWeightCap);
    expect(seeds[1].weight).toBeCloseTo(config.viewWeightCap / 2);
  });

  it("disables view members when count or cap is zero", () => {
    const views = [{ postId: 1, hash: hash(1), viewCount: 3, lastViewedAt: NOW }];
    expect(selectViewSeeds(views, NOW, { ...TEST_CONFIG, viewSeedCount: 0 })).toEqual([]);
    expect(selectViewSeeds(views, NOW, { ...TEST_CONFIG, viewWeightCap: 0 })).toEqual([]);
  });
});

describe("group and perceptual dedupe", () => {
  it("preserves ungrouped ranked order", () => {
    const posts = [ranked(1, 0.9), ranked(2, 0.8), ranked(3, 0.7)];
    expect(dedupeRankedByGroup(posts, new Map())).toEqual(posts);
  });

  it("drops a lower-ranked post sharing any claimed group", () => {
    const groups = new Map<number, number[]>([
      [1, [10]],
      [2, [20]],
      [3, [20, 30]],
    ]);
    expect(
      dedupeRankedByGroup(
        [ranked(1, 0.9), ranked(2, 0.8), ranked(3, 0.7)],
        groups
      ).map((post) => post.id)
    ).toEqual([1, 2]);
  });

  it("collapses identical blurhash and dimensions but not different dimensions", () => {
    const differentSize = { ...ranked(3, 0.7, "AAAA"), width: 200 };
    expect(
      dedupeRankedByBlurhash([
        ranked(1, 0.9, "AAAA"),
        ranked(2, 0.8, "AAAA"),
        differentSize,
      ]).map((post) => post.id)
    ).toEqual([1, 3]);
  });

  it("never collapses posts without a blurhash", () => {
    expect(
      dedupeRankedByBlurhash([ranked(1, 0.9), ranked(2, 0.8)]).map(
        (post) => post.id
      )
    ).toEqual([1, 2]);
  });
});

describe("within-cluster ranking modifiers", () => {
  it("freshness can reorder candidates without mutating the input", () => {
    const posts = [ranked(1, 1), ranked(2, 1.1)];
    const result = applyFreshnessBoost(
      posts,
      new Map([[1, NOW]]),
      NOW,
      { ...TEST_CONFIG, freshnessBoost: 0.2, freshnessHalfLifeDays: 7 }
    );
    expect(result.map((post) => post.id)).toEqual([1, 2]);
    expect(result[0].score).toBeCloseTo(1.2);
    expect(posts[0].score).toBe(1);
  });

  it("freshness halves at its configured half-life", () => {
    const result = applyFreshnessBoost(
      [ranked(1, 1)],
      new Map([[1, new Date(NOW.getTime() - 7 * DAY_MS)]]),
      NOW,
      { ...TEST_CONFIG, freshnessBoost: 0.2, freshnessHalfLifeDays: 7 }
    );
    expect(result[0].score).toBeCloseTo(1.1);
  });

  it("a fresh view applies the floor and reorders within the cluster", () => {
    const result = applyViewedPenalty(
      [ranked(1, 0.9), ranked(2, 0.5)],
      new Map([[1, NOW]]),
      NOW,
      { ...TEST_CONFIG, viewedCandidatePenaltyFloor: 0.3 }
    );
    expect(result.map((post) => post.id)).toEqual([2, 1]);
    expect(result[1].score).toBeCloseTo(0.27);
  });

  it("the viewed penalty relaxes toward one with age and can be disabled", () => {
    const config = {
      ...TEST_CONFIG,
      viewedCandidatePenaltyFloor: 0.3,
      viewRecencyHalfLifeDays: 30,
    };
    const halfLife = applyViewedPenalty(
      [ranked(1, 1)],
      new Map([[1, new Date(NOW.getTime() - 30 * DAY_MS)]]),
      NOW,
      config
    );
    const posts = [ranked(1, 1)];
    expect(halfLife[0].score).toBeCloseTo(0.65);
    expect(
      applyViewedPenalty(posts, new Map([[1, NOW]]), NOW, {
        ...config,
        viewedCandidatePenaltyFloor: 1,
      })
    ).toBe(posts);
  });
});

describe("real cluster allocation", () => {
  it("uses proportional quotas and interleaves by descending mass", () => {
    const result = taste.allocateAcrossClusters(
      new Map([
        [0, [ranked(1, 1), ranked(2, 0.9), ranked(3, 0.8)]],
        [1, [ranked(10, 1)]],
      ]),
      new Map([
        [0, 3],
        [1, 1],
      ]),
      new Map(),
      { pageSize: 4, pageCount: 1, floorShare: 0.02 }
    );
    expect(result.map(({ item }) => item.id)).toEqual([1, 10, 2, 3]);
  });

  it("gives a tiny cluster a floor-protected page slot", () => {
    const result = taste.allocateAcrossClusters(
      new Map([
        [0, [ranked(1, 1), ranked(2, 0.9), ranked(3, 0.8), ranked(4, 0.7)]],
        [1, [ranked(10, 1)]],
      ]),
      new Map([
        [0, 999],
        [1, 1],
      ]),
      new Map(),
      { pageSize: 5, pageCount: 1, floorShare: 0.2 }
    );
    expect(result.map(({ cluster }) => cluster)).toContain(1);
  });

  it("dedupes ids and groups across clusters", () => {
    const result = taste.allocateAcrossClusters(
      new Map([
        [0, [ranked(1, 1), ranked(2, 0.9)]],
        [1, [ranked(1, 1), ranked(3, 0.8)]],
      ]),
      new Map([
        [0, 1],
        [1, 1],
      ]),
      new Map([
        [2, [7]],
        [3, [7]],
      ]),
      { pageSize: 4, pageCount: 1, floorShare: 0.02 }
    );
    expect(result.map(({ item }) => item.id)).toEqual([1, 2]);
  });
});

describe("member and retrieval pipeline behavior", () => {
  it("builds weighted favorites and views after shared group collapse", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fitSpy = vi.spyOn(taste, "fitTasteModel");
    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2, 90)]);
    mocks.viewFindMany.mockResolvedValue([
      {
        postId: 4,
        post: { hash: hash(4) },
        viewCount: 8,
        lastViewedAt: NOW,
      },
      {
        postId: 5,
        post: { hash: hash(5) },
        viewCount: 8,
        lastViewedAt: new Date(NOW.getTime() - 30 * DAY_MS),
      },
      {
        postId: 6,
        post: { hash: hash(6) },
        viewCount: 8,
        lastViewedAt: NOW,
      },
    ]);
    mocks.postGroupFindMany.mockImplementation(
      (args: { where?: { group?: unknown; postId?: { in: number[] } } }) => {
        if (args.where?.group) return Promise.resolve([]);
        const ids = args.where?.postId?.in ?? [];
        if (ids.includes(1)) {
          return Promise.resolve([
            { postId: 1, groupId: 10 },
            { postId: 4, groupId: 10 },
            { postId: 5, groupId: 11 },
            { postId: 6, groupId: 11 },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    await buildFeed(TEST_CONFIG);
    const members = fitSpy.mock.calls[0][0];

    expect(members.map((member) => [member.postId, member.kind])).toEqual([
      [1, "favorite"],
      [2, "favorite"],
      [5, "view"],
    ]);
    expect(members[0].weight).toBeCloseTo(1);
    expect(members[1].weight).toBeCloseTo(0.5);
    expect(members[2].weight).toBeCloseTo(TEST_CONFIG.viewWeightCap / 2);
    expect(mocks.viewFindMany.mock.calls[0][0].where).toEqual({
      post: { favorite: { is: null }, feedDismissal: { is: null } },
    });
    fitSpy.mockRestore();
  });

  it("applies the member gate to calibrated similarity with a nonzero baseline", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.viewFindMany.mockImplementation(
      (args: { select?: { post?: unknown } }) =>
        Promise.resolve(
          args.select?.post
            ? [
                {
                  postId: 2,
                  post: { hash: hash(2) },
                  viewCount: 8,
                  lastViewedAt: NOW,
                },
              ]
            : []
        )
    );
    mocks.vectors.mockResolvedValue([
      { postId: 1, vector: new Float32Array([1, 0, 0, 0]) },
      { postId: 2, vector: new Float32Array([0, 1, 0, 0]) },
    ]);
    mocks.baseline.mockResolvedValue(0.5);
    mocks.nearest.mockImplementation(
      ({ vector }: { vector: Float32Array }) =>
        Promise.resolve(
          Math.abs(vector[0]) > Math.abs(vector[1])
            ? [
                { postId: 101, score: 0.75 },
                { postId: 102, score: 0.75 },
                { postId: 103, score: 0.6 },
              ]
            : [{ postId: 201, score: 0.75 }]
        )
    );
    mocks.maxSimilarity.mockImplementation(
      ({ candidateIds }: { candidateIds: number[] }) =>
        Promise.resolve(
          new Map(
            candidateIds.map((id) => [id, id === 102 ? 0.55 : 0.75])
          )
        )
    );

    const feed = await buildFeed(TEST_CONFIG);

    expect(feed.map((post) => post.id)).toEqual([101, 201]);
    expect(feed.find((post) => post.id === 101)?.score).toBeCloseTo(0.5);
    expect(mocks.maxSimilarity).toHaveBeenCalledTimes(1);
    expect(mocks.maxSimilarity.mock.calls[0][0].referenceIds).toEqual([1]);
  });

  it("does not exclude a viewed post's group sibling but excludes a favorite's sibling", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.viewFindMany.mockImplementation(
      (args: { select?: { post?: unknown } }) =>
        Promise.resolve(
          args.select?.post
            ? [
                {
                  postId: 2,
                  post: { hash: hash(2) },
                  viewCount: 8,
                  lastViewedAt: NOW,
                },
              ]
            : []
        )
    );
    mocks.postGroupFindMany.mockImplementation(
      (args: {
        where?: {
          group?: { posts?: { some?: { OR?: unknown[] } } };
          postId?: { in: number[] };
        };
      }) => {
        if (args.where?.group) return Promise.resolve([{ postId: 102 }]);
        const ids = args.where?.postId?.in ?? [];
        if (ids.includes(1)) {
          return Promise.resolve([
            { postId: 1, groupId: 10 },
            { postId: 102, groupId: 10 },
            { postId: 2, groupId: 20 },
            { postId: 101, groupId: 20 },
          ]);
        }
        return Promise.resolve([]);
      }
    );
    mocks.vectors.mockResolvedValue([
      { postId: 1, vector: new Float32Array([1, 0, 0, 0]) },
      { postId: 2, vector: new Float32Array([0, 1, 0, 0]) },
    ]);
    mocks.nearest.mockResolvedValue([
      { postId: 101, score: 0.9 },
      { postId: 102, score: 0.9 },
    ]);

    const feed = await buildFeed(TEST_CONFIG);
    const exclusionQuery = mocks.postGroupFindMany.mock.calls.find(
      (call) => call[0].where?.group
    )?.[0];

    expect(exclusionQuery.where.group.posts.some.OR).toEqual([
      { postId: { in: [] } },
      { post: { favorite: { isNot: null } } },
    ]);
    expect(feed.map((post) => post.id)).toEqual([101]);
  });

  it("does not issue a dismissal-radius query when there are no dismissals", async () => {
    await buildFeed(TEST_CONFIG);
    const referenceLists = mocks.maxSimilarity.mock.calls.map(
      (call) => call[0].referenceIds as number[]
    );
    expect(referenceLists.every((ids) => ids.length > 0 && !ids.includes(9))).toBe(true);
  });
});

describe("fallback boundaries", () => {
  it("uses the tag fallback when a configured store has zero embedded members", async () => {
    mocks.vectors.mockResolvedValue([]);
    mocks.tagNeighborhoods.mockResolvedValue(
      new Map([[1, [recommendation(30, 0.8)]]])
    );
    expect((await buildFeed(TEST_CONFIG)).map((post) => post.id)).toEqual([30]);
  });

  it("returns a degraded empty result without tag fallback when settings cannot be read", async () => {
    mocks.settings.mockRejectedValueOnce(new Error("settings unavailable"));
    expect((await getFeedPage(1, 48)).posts).toEqual([]);
    expect(mocks.tagNeighborhoods).not.toHaveBeenCalled();
    expect(mocks.vectors).not.toHaveBeenCalled();

    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([10]);
  });

  it("returns a degraded empty result instead of rejecting on an initial signal-read failure", async () => {
    mocks.favoriteFindMany.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(buildFeed(TEST_CONFIG)).resolves.toEqual([]);
    expect(mocks.tagNeighborhoods).not.toHaveBeenCalled();
  });

  it("does not use the tag fallback for a transient vector-store failure", async () => {
    mocks.vectors.mockRejectedValue(new Error("vector store down"));
    mocks.tagNeighborhoods.mockResolvedValue(
      new Map([[1, [recommendation(30, 0.8)]]])
    );
    expect(await buildFeed(TEST_CONFIG)).toEqual([]);
    expect(mocks.tagNeighborhoods).not.toHaveBeenCalled();
  });

  it("uses the newest 90 collapsed favorites and applies exclusions and dedupe", async () => {
    mocks.providerConfigured.mockReturnValue(false);
    mocks.favoriteFindMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => favorite(index + 1, index))
    );
    mocks.dismissalFindMany.mockResolvedValue([{ postId: 99 }]);
    mocks.postGroupFindMany.mockImplementation(
      (args: { where?: { group?: unknown; postId?: { in: number[] } } }) => {
        if (args.where?.group) return Promise.resolve([{ postId: 98 }]);
        const ids = args.where?.postId?.in ?? [];
        if (ids.includes(1)) {
          return Promise.resolve([
            { postId: 1, groupId: 10 },
            { postId: 2, groupId: 10 },
          ]);
        }
        if (ids.includes(201)) {
          return Promise.resolve([
            { postId: 201, groupId: 20 },
            { postId: 202, groupId: 20 },
          ]);
        }
        return Promise.resolve([]);
      }
    );
    const duplicateA = { ...recommendation(203, 0.6), blurhash: "SAME" };
    const duplicateB = { ...recommendation(204, 0.5), blurhash: "SAME" };
    mocks.tagNeighborhoods.mockImplementation((seedIds: number[]) =>
      Promise.resolve(
        new Map([
          [
            seedIds[0],
            [
              recommendation(1, 1),
              recommendation(99, 1),
              recommendation(98, 1),
              recommendation(201, 0.9),
              recommendation(202, 0.8),
              duplicateA,
              duplicateB,
              recommendation(205, 0.4),
            ],
          ],
        ])
      )
    );

    const feed = await buildFeed({ ...TEST_CONFIG, freshnessBoost: 0 });
    const seedIds = mocks.tagNeighborhoods.mock.calls[0][0] as number[];

    expect(seedIds).toHaveLength(90);
    expect(seedIds.slice(0, 4)).toEqual([1, 3, 4, 5]);
    expect(feed.map((post) => post.id)).toEqual([201, 203, 205]);
  });
});

describe("feed page bounds", () => {
  it("caps the cached feed at eleven pages and serves page twelve empty", async () => {
    mocks.favoriteFindMany.mockResolvedValue(
      Array.from({ length: 48 }, (_, index) => favorite(index + 1))
    );
    const directions = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [-1, 0, 0, 0],
      [0, -1, 0, 0],
    ];
    mocks.vectors.mockImplementation(({ postIds }: { postIds: number[] }) =>
      Promise.resolve(
        postIds.map((postId) => ({
          postId,
          vector: new Float32Array(directions[(postId - 1) % directions.length]),
        }))
      )
    );
    let neighborhood = 0;
    mocks.nearest.mockImplementation(() => {
      const start = 10_000 + neighborhood++ * 1_000;
      return Promise.resolve(
        Array.from({ length: 200 }, (_, index) => ({
          postId: start + index,
          score: 0.9 - index / 10_000,
        }))
      );
    });

    const page11 = await getFeedPage(11, 48);
    const page12 = await getFeedPage(12, 48);

    expect(page11.totalCount).toBeLessThanOrEqual(FEED_CONFIG.maxFeedSize);
    expect(page11.posts).toHaveLength(48);
    expect(page12.posts).toEqual([]);
    expect(page12.totalPages).toBe(11);
  });
});

describe("cache degradation and concurrency", () => {
  it.each(["vectors", "ANN", "gate"] as const)(
    "retains stale data and retries after a %s store rejection",
    async (stage) => {
      mocks.favoriteFindMany.mockResolvedValue([
        favorite(1),
        favorite(2),
        favorite(3),
      ]);
      mocks.vectors.mockResolvedValue([
        { postId: 1, vector: new Float32Array([1, 0, 0, 0]) },
        { postId: 2, vector: new Float32Array([1, 0, 0, 0]) },
        { postId: 3, vector: new Float32Array([1, 0, 0, 0]) },
      ]);
      expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
        10,
      ]);

      invalidateFeedCache();
      if (stage === "vectors") {
        mocks.toConfig.mockReturnValue({ ...EMBEDDING_CONFIG, model: "switched" });
        mocks.vectors.mockRejectedValueOnce(new Error("vectors unavailable"));
      } else if (stage === "ANN") {
        mocks.nearest.mockRejectedValueOnce(new Error("ANN unavailable"));
      } else {
        mocks.maxSimilarity.mockRejectedValueOnce(new Error("gate unavailable"));
      }
      const stale = await getFeedPage(1, 48);
      expect(stale.posts.map((post) => post.id)).toEqual([10]);
      expect(feedRebuildInFlight()).toBe(true);
      await settleFeedRebuild();

      mocks.nearest.mockResolvedValue([{ postId: 20, score: 0.9 }]);
      expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
        10,
      ]);
      await settleFeedRebuild();
      expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
        20,
      ]);
    }
  );

  it("retains stale data after a settings-read failure", async () => {
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2),
      favorite(3),
    ]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      10,
    ]);

    invalidateFeedCache();
    mocks.settings.mockRejectedValueOnce(new Error("settings unavailable"));
    mocks.tagNeighborhoods.mockResolvedValue(
      new Map([[1, [recommendation(30, 0.9)]]])
    );
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      10,
    ]);
    await settleFeedRebuild();

    mocks.nearest.mockResolvedValue([{ postId: 20, score: 0.9 }]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      10,
    ]);
    await settleFeedRebuild();
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      20,
    ]);
  });

  it("returns a cold degraded result but rebuilds instead of caching it", async () => {
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2),
      favorite(3),
    ]);
    mocks.nearest.mockRejectedValueOnce(new Error("ANN unavailable"));
    expect((await getFeedPage(1, 48)).posts).toEqual([]);

    mocks.nearest.mockResolvedValue([{ postId: 20, score: 0.9 }]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      20,
    ]);
  });

  it("coalesces concurrent cold reads and settleFeedRebuild waits for completion", async () => {
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2),
      favorite(3),
    ]);
    let resolveNearest:
      | ((neighbors: { postId: number; score: number }[]) => void)
      | undefined;
    mocks.nearest.mockReturnValue(
      new Promise<{ postId: number; score: number }[]>((resolve) => {
        resolveNearest = resolve;
      })
    );

    const first = getFeedPage(1, 48);
    const second = getFeedPage(1, 48);
    await vi.waitFor(() => expect(mocks.nearest).toHaveBeenCalledTimes(1));
    expect(feedRebuildInFlight()).toBe(true);
    resolveNearest?.([{ postId: 10, score: 0.9 }]);

    const [firstPage, secondPage] = await Promise.all([first, second]);
    await settleFeedRebuild();
    expect(firstPage.posts).toEqual(secondPage.posts);
    expect(feedRebuildInFlight()).toBe(false);
  });

  it("clearFeedCache hard-drops stale content while invalidate keeps it servable", async () => {
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2),
      favorite(3),
    ]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      10,
    ]);

    invalidateFeedCache();
    mocks.nearest.mockResolvedValue([{ postId: 20, score: 0.9 }]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      10,
    ]);
    await settleFeedRebuild();

    clearFeedCache();
    mocks.nearest.mockResolvedValue([{ postId: 30, score: 0.9 }]);
    expect((await getFeedPage(1, 48)).posts.map((post) => post.id)).toEqual([
      30,
    ]);
  });
});
