import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";

const mocks = vi.hoisted(() => ({
  vectors: vi.fn(),
  nearest: vi.fn(),
  related: vi.fn(),
  prefixes: vi.fn(),
  sampleUnseen: vi.fn(),
  maxSimilarity: vi.fn(),
  tagNeighborhoods: vi.fn(),
  favoriteFindMany: vi.fn(),
  dismissalFindMany: vi.fn(),
  viewFindMany: vi.fn(),
  postGroupFindMany: vi.fn(),
  postFindMany: vi.fn(),
  settingsFindMany: vi.fn(),
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
  findRelatedPostsByEmbeddingForPosts: mocks.related,
  getEmbeddingPrefixesForPosts: mocks.prefixes,
  sampleUnseenEmbeddedPostIds: mocks.sampleUnseen,
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
    settings: { findMany: mocks.settingsFindMany },
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
  interleaveExploration,
  dedupeRankedByBlurhash,
  dedupeRankedByGroup,
  feedRebuildInFlight,
  getFeedPage,
  invalidateFeedCache,
  mergeSeedCandidates,
  rankMemberNeighbors,
  seedWeight,
  selectExploration,
  selectViewSeeds,
  spaceExploration,
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
  videoEnabled: false,
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
  mocks.related.mockImplementation(({ postIds }: { postIds: number[] }) =>
    Promise.resolve(new Map(postIds.map((postId) => [postId, []])))
  );
  mocks.prefixes.mockResolvedValue(new Map());
  mocks.sampleUnseen.mockResolvedValue([]);
  mocks.settingsFindMany.mockResolvedValue([]);
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

describe("favorites retrieval", () => {
  const FAVORITES_CONFIG: FeedConfig = { ...TEST_CONFIG, retrieval: "favorites" };
  /** Store-shaped neighbor lists: member id -> [neighbor id, raw cosine][]. */
  function relatedFrom(lists: Record<number, [number, number][]>) {
    return ({ postIds }: { postIds: number[] }) =>
      Promise.resolve(
        new Map(
          postIds.map((postId) => [
            postId,
            (lists[postId] ?? []).map(([id, score]) => ({ ...card(id), score })),
          ])
        )
      );
  }

  it("ranks each member's best match above another member's distant ones", () => {
    const ranked = rankMemberNeighbors(
      [
        { weight: 1, neighbors: [{ id: 1, score: 0.9 }, { id: 2, score: 0.9 }, { id: 3, score: 0.9 }] },
        { weight: 1, neighbors: [{ id: 4, score: 0.8 }] },
      ],
      { memberWeightExponent: 0.5, neighborRankDecay: 0.5, convergenceDecay: 0.5 }
    );

    expect(ranked.map((entry) => entry.id)).toEqual([1, 4, 2, 3]);
    expect(ranked[2].score).toBeCloseTo(0.45);
  });

  it("applies the recency exponent and a diminishing convergence bonus", () => {
    const config = { memberWeightExponent: 0.5, neighborRankDecay: 1, convergenceDecay: 0.5 };
    const ranked = rankMemberNeighbors(
      [
        { weight: 1, neighbors: [{ id: 1, score: 0.6 }, { id: 2, score: 0.7 }] },
        { weight: 0.25, neighbors: [{ id: 1, score: 0.8 }, { id: 3, score: 1 }] },
        { weight: 0, neighbors: [{ id: 9, score: 1 }] },
      ],
      config
    );

    // id 1: 0.6 in full plus half of sqrt(0.25) * 0.8; a zero-weight member adds nothing.
    expect(ranked.map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(ranked[0].score).toBeCloseTo(0.8);
    expect(ranked[1].score).toBeCloseTo(0.7);
    expect(ranked[2].score).toBeCloseTo(0.5);
    expect(
      rankMemberNeighbors(
        [{ weight: 0.25, neighbors: [{ id: 3, score: 1 }] }],
        { ...config, memberWeightExponent: 0 }
      )[0].score
    ).toBeCloseTo(1);
  });

  it("retrieves from members instead of centroids and applies the gate, exclusions and dismissals", async () => {
    // Pin the clock so both favorites carry weight 1.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.baseline.mockResolvedValue(0.5);
    mocks.dismissalFindMany.mockResolvedValue([{ postId: 9 }]);
    mocks.postGroupFindMany.mockImplementation(
      (args: { where?: { group?: unknown } }) =>
        Promise.resolve(args.where?.group ? [{ postId: 99 }] : [])
    );
    mocks.related.mockImplementation(
      relatedFrom({
        // 2 is a favorite, 9 dismissed, 99 a favorite's sibling, 103 below the gate.
        1: [[2, 0.99], [9, 0.99], [99, 0.99], [101, 0.9], [102, 0.8], [103, 0.6]],
        2: [[201, 0.9], [202, 0.8]],
      })
    );
    mocks.maxSimilarity.mockImplementation(
      ({ candidateIds }: { candidateIds: number[] }) =>
        Promise.resolve(new Map(candidateIds.map((id) => [id, id === 202 ? 0.95 : 0.1])))
    );

    const feed = await buildFeed({ ...FAVORITES_CONFIG, memberGate: 0.5 });

    expect(feed.map((post) => post.id).sort()).toEqual([101, 102, 201]);
    // Calibrated at baseline 0.5: raw 0.9 -> 0.8 for the member's first neighbor.
    expect(feed.find((post) => post.id === 101)?.score).toBeCloseTo(0.8);
    expect(mocks.nearest).not.toHaveBeenCalled();
    // Only the dismissal-radius check runs; there is no centroid member gate.
    expect(mocks.maxSimilarity).toHaveBeenCalledTimes(1);
    expect(mocks.maxSimilarity.mock.calls[0][0].referenceIds).toEqual([9]);
    expect(mocks.related.mock.calls[0][0].limit).toBe(FAVORITES_CONFIG.neighborsPerMember);
  });

  it("reaches a favorite's own neighbors that the centroid scan misses", async () => {
    // One cluster of three: two favorites near each other and one apart.
    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(3), favorite(2)]);
    const oneCluster = { ...TEST_CONFIG, clusterCount: 1 };
    mocks.nearest.mockResolvedValue([{ postId: 101, score: 0.9 }]);
    mocks.related.mockImplementation(
      relatedFrom({ 1: [[101, 0.9]], 3: [[101, 0.9]], 2: [[201, 0.9]] })
    );

    const centroid = await buildFeed(oneCluster);
    clearFeedCache();
    const favorites = await buildFeed({ ...oneCluster, retrieval: "favorites" });

    expect(centroid.map((post) => post.id)).toEqual([101]);
    expect(favorites.map((post) => post.id)).toEqual([101, 201]);
  });

  it("fetches each member's neighbors once and only new members on later builds", async () => {
    mocks.related.mockImplementation(relatedFrom({ 1: [[101, 0.9]], 2: [[201, 0.9]], 3: [[301, 0.9]] }));

    await buildFeed(FAVORITES_CONFIG);
    await buildFeed(FAVORITES_CONFIG);
    expect(mocks.related).toHaveBeenCalledTimes(1);
    expect(mocks.related.mock.calls[0][0].postIds).toEqual([1, 2]);

    mocks.favoriteFindMany.mockResolvedValue([favorite(3), favorite(1), favorite(2)]);
    const feed = await buildFeed(FAVORITES_CONFIG);
    expect(mocks.related).toHaveBeenCalledTimes(2);
    expect(mocks.related.mock.calls[1][0].postIds).toEqual([3]);
    expect(feed.map((post) => post.id).sort()).toEqual([101, 201, 301]);

    clearFeedCache();
    await buildFeed(FAVORITES_CONFIG);
    expect(mocks.related).toHaveBeenCalledTimes(3);
    expect(mocks.related.mock.calls[2][0].postIds).toHaveLength(3);
  });

  it("does not refetch a member when overlapping builds share a cold fill", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.related.mockImplementation(async (args: { postIds: number[] }) => {
      await gate;
      return relatedFrom({ 1: [[101, 0.9]], 2: [[201, 0.9]] })(args);
    });

    const first = buildFeed(FAVORITES_CONFIG);
    const second = buildFeed(FAVORITES_CONFIG);
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(mocks.related).toHaveBeenCalledTimes(1);
    expect(a.map((post) => post.id)).toEqual(b.map((post) => post.id));
  });

  it("keeps a just-added favorite's neighbors when an older overlapping build finishes later", async () => {
    // The older build is held at the calibration baseline, after its own
    // neighbor lists are fetched and before it reads them.
    let releaseBaseline!: (baseline: number) => void;
    mocks.baseline.mockReturnValue(
      new Promise<number>((resolve) => {
        releaseBaseline = resolve;
      })
    );
    mocks.related.mockImplementation(relatedFrom({ 1: [[101, 0.9]], 2: [[201, 0.9]], 3: [[301, 0.9]] }));

    const older = buildFeed(FAVORITES_CONFIG);
    await vi.waitFor(() => expect(mocks.related).toHaveBeenCalledTimes(1));
    // A favorite lands; the build it triggers fetches the new member's list
    // while the older build is still waiting.
    mocks.favoriteFindMany.mockResolvedValue([favorite(3), favorite(1), favorite(2)]);
    const newer = buildFeed(FAVORITES_CONFIG);
    await vi.waitFor(() => expect(mocks.related).toHaveBeenCalledTimes(2));
    expect(mocks.related.mock.calls[1][0].postIds).toEqual([3]);

    releaseBaseline(0);
    const [olderFeed, newerFeed] = await Promise.all([older, newer]);

    // The older build does not know post 3 and must not take its list away.
    expect(olderFeed.map((post) => post.id).sort()).toEqual([101, 201]);
    expect(newerFeed.map((post) => post.id).sort()).toEqual([101, 201, 301]);
  });

  it("keeps a build's neighbor lists when a build with fewer members is queued behind it", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(3), favorite(1), favorite(2)]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.related.mockImplementation(async (args: { postIds: number[] }) => {
      await gate;
      return relatedFrom({ 1: [[101, 0.9]], 2: [[201, 0.9]], 3: [[301, 0.9]] })(args);
    });

    // The first build's fill is in flight when a build without post 3 queues
    // behind it; that build evicts post 3's list once its turn comes.
    const larger = buildFeed(FAVORITES_CONFIG);
    await vi.waitFor(() => expect(mocks.related).toHaveBeenCalledTimes(1));
    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2)]);
    const smaller = buildFeed(FAVORITES_CONFIG);
    release();
    const [largerFeed, smallerFeed] = await Promise.all([larger, smaller]);

    expect(largerFeed.map((post) => post.id).sort()).toEqual([101, 201, 301]);
    expect(smallerFeed.map((post) => post.id).sort()).toEqual([101, 201]);
    // Nothing was fetched twice.
    expect(mocks.related).toHaveBeenCalledTimes(1);
  });

  it("evicts a removed favorite's neighbor list and refetches it if the favorite returns", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(3), favorite(1), favorite(2)]);
    mocks.related.mockImplementation(relatedFrom({ 1: [[101, 0.9]], 2: [[201, 0.9]], 3: [[301, 0.9]] }));
    await buildFeed(FAVORITES_CONFIG);
    expect(mocks.related).toHaveBeenCalledTimes(1);

    mocks.favoriteFindMany.mockResolvedValue([favorite(1), favorite(2)]);
    const without = await buildFeed(FAVORITES_CONFIG);
    expect(without.map((post) => post.id).sort()).toEqual([101, 201]);
    expect(mocks.related).toHaveBeenCalledTimes(1);

    mocks.favoriteFindMany.mockResolvedValue([favorite(3), favorite(1), favorite(2)]);
    const back = await buildFeed(FAVORITES_CONFIG);
    expect(back.map((post) => post.id).sort()).toEqual([101, 201, 301]);
    expect(mocks.related).toHaveBeenCalledTimes(2);
    expect(mocks.related.mock.calls[1][0].postIds).toEqual([3]);
  });

  it("reports a degraded build when the neighbor lookup rejects", async () => {
    mocks.related.mockRejectedValue(new Error("vector store down"));

    await expect(buildFeed(FAVORITES_CONFIG)).resolves.toEqual([]);

    mocks.related.mockImplementation(relatedFrom({ 1: [[101, 0.9]] }));
    const feed = await buildFeed(FAVORITES_CONFIG);
    expect(feed.map((post) => post.id)).toEqual([101]);
  });
});

describe("variety pass and exploration", () => {
  const unit = (values: number[]) => {
    const norm = Math.hypot(...values);
    return new Float32Array(values.map((value) => value / norm));
  };
  // 11 and 12 are near-twins of 10; 13 is unlike all of them.
  const TWIN_PREFIXES = new Map([
    [10, unit([1, 0])],
    [11, unit([0.999, 0.04])],
    [12, unit([0.998, 0.06])],
    [13, unit([0, 1])],
  ]);
  /** ANN stub: a query along axis k returns posts k*100+1.. with falling scores. */
  function useAxisNeighbors(perAxis: number) {
    mocks.nearest.mockImplementation(({ vector }: { vector: ArrayLike<number> }) => {
      const axis = Array.from(vector).findIndex((value) => value > 0.9) + 1;
      return Promise.resolve(
        Array.from({ length: perAxis }, (_, index) => ({
          postId: axis * 100 + index + 1,
          score: 0.95 - index * 0.05,
        }))
      );
    });
  }

  it("leaves both passes off by default", async () => {
    // Pinned clock: with equal-mass clusters the hourly seed decides which leads.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(FEED_CONFIG.diversityLambda).toBe(1);
    expect(FEED_CONFIG.exploreShare).toBe(0);
    useAxisNeighbors(8);

    const feed = await buildFeed(TEST_CONFIG);

    // Pure relevance order per cluster, interleaved; no prefix read.
    expect(feed.map((post) => post.id)).toEqual([101, 201, 102, 202, 103, 203, 104, 204]);
    expect(mocks.prefixes).not.toHaveBeenCalled();
  });

  it("orders a centroid cluster's candidates for variety using embedding prefixes", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.nearest.mockResolvedValue([
      { postId: 10, score: 0.9 },
      { postId: 11, score: 0.89 },
      { postId: 12, score: 0.88 },
      { postId: 13, score: 0.6 },
    ]);
    mocks.prefixes.mockResolvedValue(TWIN_PREFIXES);

    const feed = await buildFeed({ ...TEST_CONFIG, diversityLambda: 0.7 });

    expect(feed.map((post) => post.id)).toEqual([10, 13, 11, 12]);
    expect(mocks.prefixes).toHaveBeenCalledTimes(1);
    expect(mocks.prefixes.mock.calls[0][0]).toMatchObject({
      prefixDimensions: TEST_CONFIG.diversityDimensions,
    });
    expect([...mocks.prefixes.mock.calls[0][0].postIds].sort()).toEqual([10, 11, 12, 13]);
    // Relevance scores are untouched; only the order changes.
    expect(feed.find((post) => post.id === 13)?.score).toBeCloseTo(0.6);
  });

  it("applies the variety pass to favorites retrieval too", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.related.mockImplementation(({ postIds }: { postIds: number[] }) =>
      Promise.resolve(
        new Map(
          postIds.map((postId) => [
            postId,
            [
              [10, 0.9],
              [11, 0.89],
              [12, 0.88],
              [13, 0.87],
            ].map(([id, score]) => ({ ...card(id), score })),
          ])
        )
      )
    );
    mocks.prefixes.mockResolvedValue(TWIN_PREFIXES);
    const favorites: FeedConfig = { ...TEST_CONFIG, retrieval: "favorites" };

    const plain = await buildFeed(favorites);
    expect(plain.map((post) => post.id)).toEqual([10, 11, 12, 13]);

    const diversified = await buildFeed({ ...favorites, diversityLambda: 0.7 });
    expect(diversified.map((post) => post.id)).toEqual([10, 13, 11, 12]);
  });

  it("selects exploration posts unlike every taste member and spreads them apart", () => {
    const members = new Float32Array([...unit([1, 0]), ...unit([0, 1])]);
    const prefixes = new Map([
      [10, unit([1, 0.05])], // next to the first member
      [11, unit([-1, 0])],
      [12, unit([-1, -0.05])], // near-twin of 11
      [13, unit([0, -1])],
      // 14 has no prefix
    ]);

    const picked = selectExploration([10, 11, 12, 13, 14], prefixes, members, 2, {
      maxSimilarity: 0.5,
    });

    // 10 is too close to a favorite and 14 cannot be compared. 13 follows 11
    // because 12 is nearly the same post as 11.
    expect(picked.map((candidate) => candidate.id)).toEqual([11, 13, 12]);
    expect(picked.map((candidate) => candidate.score)).toEqual([1, 2 / 3, 1 / 3].map((score) => expect.closeTo(score, 6)));

    // The similarity mapping decides what counts as close...
    expect(
      selectExploration([10], prefixes, members, 2, {
        maxSimilarity: 0.5,
        similarity: (cosine) => cosine * 0.4,
      }).map((candidate) => candidate.id)
    ).toEqual([10]);
    // ...and with no taste members everything comparable qualifies.
    expect(
      selectExploration([10, 14], prefixes, new Float32Array(0), 2, { maxSimilarity: 0.5 }).map(
        (candidate) => candidate.id
      )
    ).toEqual([10]);
  });

  it("spaces exploration posts evenly within each page without moving posts between pages", () => {
    type Item = { id: number; explore?: true };
    const taste = (id: number): Item => ({ id });
    const explore = (id: number): Item => ({ id, explore: true });
    // Page one opens with its two exploration posts; page two has one at the end.
    const items = [
      explore(91), explore(92), taste(1), taste(2), taste(3), taste(4), taste(5), taste(6), taste(7), taste(8),
      taste(9), taste(10), taste(11), explore(93),
    ];

    const spaced = spaceExploration(items, 10);

    expect(spaced.map((item) => item.id)).toEqual([
      1, 2, 91, 3, 4, 5, 6, 92, 7, 8,
      9, 10, 93, 11,
    ]);
    // Nothing to space, or nothing to space it among: unchanged.
    expect(spaceExploration([taste(1), taste(2)], 10).map((item) => item.id)).toEqual([1, 2]);
    expect(spaceExploration([explore(91), explore(92)], 10).map((item) => item.id)).toEqual([91, 92]);
    expect(spaceExploration(items, 0)).toEqual(items);
  });

  /** Sampled unseen posts 301-304; 303 sits right next to favorite 1. */
  function useExploreSample() {
    mocks.sampleUnseen.mockResolvedValue([301, 302, 303, 304, 1]);
    mocks.prefixes.mockImplementation(({ postIds }: { postIds: number[] }) => {
      const all = new Map([
        [301, unit([0, 0, 1, 0])],
        [302, unit([0, 0, 0, 1])],
        [303, unit([1, 0.02, 0, 0])],
        [304, unit([-1, 0, 0, 0])],
      ]);
      return Promise.resolve(new Map(postIds.flatMap((id) => (all.has(id) ? [[id, all.get(id)!] as const] : []))));
    });
  }

  it("gives exploration its page share from unseen posts outside the taste model's reach", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useAxisNeighbors(8);
    useExploreSample();

    const feed = await buildFeed({ ...TEST_CONFIG, exploreShare: 0.25 });

    // A quarter of each four-post page is exploration, farthest-first; 303
    // is too close to a favorite and the sampled favorite (1) is excluded.
    const explored = feed.filter((post) => post.explore);
    expect(explored.map((post) => post.id)).toEqual([301, 302]);
    for (const page of [feed.slice(0, 4), feed.slice(4, 8)]) {
      expect(page.filter((post) => post.explore)).toHaveLength(1);
      // Mid-page, not leading it.
      expect(page.findIndex((post) => post.explore)).toBe(2);
    }
    expect(feed.filter((post) => !post.explore).every((post) => post.id < 300)).toBe(true);
    expect(mocks.sampleUnseen).toHaveBeenCalledTimes(1);
    expect(mocks.sampleUnseen.mock.calls[0][0]).toMatchObject({
      limit: TEST_CONFIG.exploreSampleSize,
      seed: Math.floor(NOW.getTime() / 3_600_000),
    });
    expect(mocks.prefixes.mock.calls[0][0].postIds).toEqual([301, 302, 303, 304]);

    // At half the page the exploration list outweighs both clusters and
    // allocation alone would put it first; it is spaced out instead.
    const half = await buildFeed({ ...TEST_CONFIG, exploreShare: 0.5 });
    expect(half.slice(0, 4).map((post) => Boolean(post.explore))).toEqual([false, true, false, true]);
  });

  it("does not sample when exploration is off, and drops exploration posts near a dismissal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useAxisNeighbors(8);
    useExploreSample();

    await buildFeed(TEST_CONFIG);
    expect(mocks.sampleUnseen).not.toHaveBeenCalled();

    mocks.dismissalFindMany.mockResolvedValue([{ postId: 9 }]);
    mocks.maxSimilarity.mockImplementation(
      ({ candidateIds, referenceIds }: { candidateIds: number[]; referenceIds: number[] }) => {
        const nearDismissal = referenceIds.length === 1 && referenceIds[0] === 9;
        return Promise.resolve(
          new Map(candidateIds.map((id) => [id, nearDismissal ? (id === 301 ? 0.95 : 0.1) : 0.9]))
        );
      }
    );
    const feed = await buildFeed({ ...TEST_CONFIG, exploreShare: 0.25 });
    expect(feed.filter((post) => post.explore).map((post) => post.id)).toEqual([302, 304]);
  });

  it("adds exploration per page in proportion to the taste posts on it", () => {
    type Item = { id: number; explore?: true };
    const taste = (id: number): Item => ({ id });
    const explore = (id: number): Item => ({ id, explore: true });
    const tasteItems = Array.from({ length: 11 }, (_, index) => taste(index + 1));
    const exploreItems = Array.from({ length: 10 }, (_, index) => explore(91 + index));
    const options = { pageSize: 10, explorePerPage: 2, exploreShare: 0.2 };

    const feed = interleaveExploration(tasteItems, exploreItems, options);

    // Page one: 8 taste + 2 exploration. Page two has 3 taste posts left, a
    // fifth of which rounds to one exploration post, not the two a full page gets.
    const pageOne = feed.slice(0, 10);
    const pageTwo = feed.slice(10);
    expect(pageOne.filter((item) => item.explore).map((item) => item.id)).toEqual([91, 92]);
    expect(pageOne.filter((item) => !item.explore)).toHaveLength(8);
    expect(pageTwo.map((item) => item.id).sort((a, b) => a - b)).toEqual([9, 10, 11, 93]);
    expect(feed.filter((item) => !item.explore).map((item) => item.id)).toEqual(tasteItems.map((item) => item.id));

    // Nothing to add, or nothing to add it to.
    expect(interleaveExploration(tasteItems, [], options)).toEqual(tasteItems);
    expect(interleaveExploration([], exploreItems, options)).toEqual([]);
    expect(interleaveExploration(tasteItems, exploreItems, { ...options, explorePerPage: 0 })).toEqual(tasteItems);
  });

  it("fills exploration slots it cannot use with taste posts, keeping every page full", () => {
    type Item = { id: number; explore?: true };
    const taste: Item[] = Array.from({ length: 40 }, (_, index) => ({ id: index + 1 }));
    const one: Item[] = [{ id: 91, explore: true }];

    // Half of each eight-post page is reserved for exploration, but only one
    // exploration post exists: the feed is still three full pages.
    const feed = interleaveExploration(taste, one, { pageSize: 8, pageCount: 3, explorePerPage: 4, exploreShare: 0.5 });

    expect(feed).toHaveLength(24);
    expect(feed.filter((item) => item.explore).map((item) => item.id)).toEqual([91]);
    expect(feed.filter((item) => !item.explore).map((item) => item.id)).toEqual(taste.slice(0, 23).map((item) => item.id));
    // With plenty of both, a page holds exactly its allowance.
    const many: Item[] = Array.from({ length: 30 }, (_, index) => ({ id: 91 + index, explore: true }));
    const full = interleaveExploration(taste, many, { pageSize: 8, pageCount: 3, explorePerPage: 4, exploreShare: 0.5 });
    expect(full).toHaveLength(24);
    for (const start of [0, 8, 16]) {
      expect(full.slice(start, start + 8).filter((item) => item.explore)).toHaveLength(4);
    }
  });

  it("skips exploration posts that duplicate a taste post or an earlier exploration post", () => {
    type Item = { id: number; explore?: true };
    const taste: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const explore: Item[] = [91, 92, 93, 94, 2].map((id) => ({ id, explore: true }));
    const groups = new Map([
      [1, [7]],
      [91, [7]], // same group as taste post 1
      [93, [8]],
      [94, [8]], // same group as exploration post 93
    ]);
    const keys = new Map([
      [3, "same-picture"],
      [92, "same-picture"], // same image as taste post 3
    ]);

    const feed = interleaveExploration(taste, explore, {
      pageSize: 8,
      explorePerPage: 4,
      exploreShare: 0.5,
      groupIdsByPostId: groups,
      dedupeKeyByPostId: keys,
    });

    expect(feed.filter((item) => item.explore).map((item) => item.id)).toEqual([93]);
    expect(feed.map((item) => item.id).filter((id) => id === 2)).toHaveLength(1);
  });

  it("keeps exploration at its share when most taste candidates collapse into one group", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    // Twenty taste candidates, all pages of the same post group: one survives.
    const tasteIds = Array.from({ length: 20 }, (_, index) => 101 + index);
    mocks.nearest.mockResolvedValue(tasteIds.map((postId, index) => ({ postId, score: 0.95 - index * 0.01 })));
    mocks.postGroupFindMany.mockImplementation(
      (args: { where?: { group?: unknown; postId?: { in: number[] } } }) =>
        Promise.resolve(
          args.where?.group ? [] : (args.where?.postId?.in ?? []).filter((id) => id < 200).map((postId) => ({ postId, groupId: 5 }))
        )
    );
    const sampled = Array.from({ length: 20 }, (_, index) => 301 + index);
    mocks.sampleUnseen.mockResolvedValue(sampled);
    mocks.prefixes.mockResolvedValue(
      new Map(sampled.map((id, index) => [id, unit([0, Math.cos(index), Math.sin(index), 1])]))
    );

    const feed = await buildFeed({ ...TEST_CONFIG, exploreShare: 0.5, pageSize: 8, pageCount: 3, maxFeedSize: 24 });

    expect(feed.filter((post) => !post.explore)).toHaveLength(1);
    expect(feed.filter((post) => post.explore)).toHaveLength(1);
  });

  it("returns a full-length feed when few exploration posts survive", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.nearest.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({ postId: 101 + index, score: 0.95 - index * 0.01 }))
    );
    mocks.sampleUnseen.mockResolvedValue([301]);
    mocks.prefixes.mockResolvedValue(new Map([[301, unit([0, 0, 1, 0])]]));
    const config = { ...TEST_CONFIG, pageSize: 4, pageCount: 3, maxFeedSize: 12 };

    const withExploration = await buildFeed({ ...config, exploreShare: 0.5 });
    const without = await buildFeed(config);

    // Same length as without exploration: the unused exploration slots hold taste posts.
    expect(without).toHaveLength(12);
    expect(withExploration).toHaveLength(12);
    expect(withExploration.filter((post) => post.explore).map((post) => post.id)).toEqual([301]);
  });

  it("never labels a post the taste model also returned as exploration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    // Post 301 is far enough from the favorite to pass the exploration
    // cutoff, but the taste retrieval returned it as well.
    mocks.nearest.mockResolvedValue([
      { postId: 101, score: 0.95 },
      { postId: 102, score: 0.9 },
      { postId: 103, score: 0.85 },
      { postId: 301, score: 0.3 },
    ]);
    mocks.sampleUnseen.mockResolvedValue([301, 302]);
    mocks.prefixes.mockResolvedValue(
      new Map([
        [301, unit([0.3, 0.954, 0, 0])],
        [302, unit([0, 0, 1, 0])],
      ])
    );

    const feed = await buildFeed({ ...TEST_CONFIG, exploreShare: 0.25, pageSize: 8, pageCount: 1 });

    expect(feed.find((post) => post.id === 301)?.explore).toBeUndefined();
    expect(feed.filter((post) => post.explore).map((post) => post.id)).toEqual([302]);
  });

  it("gives a page the taste model cannot fill proportionally less exploration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    // Three taste candidates and plenty of exploration candidates, on pages
    // of eight: the empty slots must not fill up with exploration.
    mocks.nearest.mockResolvedValue([
      { postId: 101, score: 0.95 },
      { postId: 102, score: 0.9 },
      { postId: 103, score: 0.85 },
    ]);
    const sampled = Array.from({ length: 12 }, (_, index) => 301 + index);
    mocks.sampleUnseen.mockResolvedValue(sampled);
    mocks.prefixes.mockResolvedValue(
      new Map(sampled.map((id, index) => [id, unit([0, Math.cos(index), Math.sin(index), 1])]))
    );
    const config = { ...TEST_CONFIG, pageSize: 8, pageCount: 2, maxFeedSize: 16 };

    const quarter = await buildFeed({ ...config, exploreShare: 0.25 });
    // A quarter of a feed with three taste posts is one exploration post.
    expect(quarter.filter((post) => !post.explore).map((post) => post.id)).toEqual([101, 102, 103]);
    expect(quarter.filter((post) => post.explore)).toHaveLength(1);

    const half = await buildFeed({ ...config, exploreShare: 0.5 });
    expect(half.filter((post) => post.explore)).toHaveLength(3);

    // No taste candidates at all: no exploration-only feed.
    mocks.nearest.mockResolvedValue([]);
    expect(await buildFeed({ ...config, exploreShare: 0.5 })).toEqual([]);
  });

  it("reorders only the most relevant candidates of a long list for variety", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    const ids = Array.from({ length: 10 }, (_, index) => 11 + index);
    mocks.nearest.mockResolvedValue(ids.map((postId, index) => ({ postId, score: 0.9 - index * 0.02 })));
    // 12 and 13 are near-twins of 11; 14 is unlike them. Depth 2 gives a pool of six.
    mocks.prefixes.mockImplementation(({ postIds }: { postIds: number[] }) =>
      Promise.resolve(
        new Map(postIds.map((id) => [id, id === 14 ? unit([0, 1]) : unit([1, (id - 11) * 0.01])]))
      )
    );

    const feed = await buildFeed({
      ...TEST_CONFIG,
      diversityLambda: 0.7,
      diversityDepth: 2,
      pageSize: 10,
      pageCount: 1,
      maxFeedSize: 10,
    });

    // Prefixes are read for the pool only, however long the list is...
    expect([...mocks.prefixes.mock.calls[0][0].postIds].sort()).toEqual([11, 12, 13, 14, 15, 16]);
    // ...the distinct post moves up within it, and the rest keeps its order.
    expect(feed.map((post) => post.id)).toEqual([11, 14, 12, 13, 15, 16, 17, 18, 19, 20]);
  });

  it("flattens page quotas with the quota exponent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // Two single-favorite clusters; the second favorite is two half-lives
    // old, so its cluster has a quarter of the mass.
    mocks.favoriteFindMany.mockResolvedValue([
      favorite(1),
      favorite(2, 2 * TEST_CONFIG.recencyHalfLifeDays),
    ]);
    useAxisNeighbors(10);
    const config = { ...TEST_CONFIG, pageSize: 10, pageCount: 1, maxFeedSize: 10 };
    const split = async (quotaExponent: number) => {
      const feed = await buildFeed({ ...config, quotaExponent });
      const heavy = feed.filter((post) => Math.floor(post.id / 100) === 1).length;
      return [heavy, feed.length - heavy];
    };

    expect(await split(1)).toEqual([8, 2]);
    expect(await split(0.5)).toEqual([7, 3]);
    expect(await split(0)).toEqual([5, 5]);
  });

  it("reports a degraded build when the prefix lookup rejects", async () => {
    mocks.favoriteFindMany.mockResolvedValue([favorite(1)]);
    mocks.nearest.mockResolvedValue([
      { postId: 10, score: 0.9 },
      { postId: 11, score: 0.8 },
      { postId: 12, score: 0.7 },
    ]);
    mocks.prefixes.mockRejectedValue(new Error("vector store down"));

    await expect(buildFeed({ ...TEST_CONFIG, diversityLambda: 0.7 })).resolves.toEqual([]);
    // Off, the same store state builds normally.
    const feed = await buildFeed(TEST_CONFIG);
    expect(feed.map((post) => post.id)).toEqual([10, 11, 12]);
  });
});

describe("options set in the admin panel", () => {
  const stored = (pairs: Record<string, string>) =>
    mocks.settingsFindMany.mockResolvedValue(Object.entries(pairs).map(([key, value]) => ({ key, value })));
  function useNeighborLists() {
    mocks.related.mockImplementation(({ postIds }: { postIds: number[] }) =>
      Promise.resolve(new Map(postIds.map((postId) => [postId, [{ ...card(postId * 100 + 1), score: 0.9 }]])))
    );
  }

  it("builds the app's feed with the stored options", async () => {
    stored({ "feed.retrieval": "favorites", "feed.exploreShare": "0.25" });
    useNeighborLists();

    const page = await getFeedPage(1, 48);

    // Favorites retrieval instead of the centroid scan, and an exploration sample.
    expect(mocks.related).toHaveBeenCalled();
    expect(mocks.nearest).not.toHaveBeenCalled();
    expect(mocks.sampleUnseen).toHaveBeenCalledTimes(1);
    expect(page.posts.map((post) => post.id).sort()).toEqual([101, 201]);
    expect(mocks.settingsFindMany).toHaveBeenCalledTimes(1);
  });

  it("reads them for buildFeed() without a config, never for an explicit one", async () => {
    stored({ "feed.retrieval": "favorites" });
    useNeighborLists();

    await buildFeed(TEST_CONFIG);
    expect(mocks.settingsFindMany).not.toHaveBeenCalled();
    expect(mocks.related).not.toHaveBeenCalled();

    await buildFeed();
    expect(mocks.settingsFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.related).toHaveBeenCalled();
  });

  it("ignores stored values that are not valid", async () => {
    stored({ "feed.retrieval": "sideways", "feed.exploreShare": "0.9" });

    await getFeedPage(1, 48);

    expect(mocks.nearest).toHaveBeenCalled();
    expect(mocks.related).not.toHaveBeenCalled();
    expect(mocks.sampleUnseen).not.toHaveBeenCalled();
  });

  it("does not cache a feed built while the options could not be read", async () => {
    mocks.settingsFindMany.mockRejectedValueOnce(new Error("database unavailable"));

    expect((await getFeedPage(1, 48)).posts).toEqual([]);
    // The next read builds again instead of serving the failed result.
    expect((await getFeedPage(1, 48)).posts.length).toBeGreaterThan(0);
    expect(mocks.settingsFindMany).toHaveBeenCalledTimes(2);
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
