import { describe, it, expect } from "vitest";
import {
  FEED_CONFIG,
  seedWeight,
  selectSeeds,
  mergeSeedCandidates,
  type FavoriteSeedInput,
  type SeedContribution,
  type FeedConfig,
} from "./feed";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-07-03T00:00:00Z");

function favorite(postId: number, ageDays: number): FavoriteSeedInput {
  return {
    postId,
    hash: postId.toString(16).padStart(64, "0"),
    favoritedAt: new Date(NOW.getTime() - ageDays * DAY_MS),
  };
}

function candidate(id: number, score: number) {
  return {
    id,
    hash: id.toString(16).padStart(64, "0"),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    distance: 1 - score,
    score,
  };
}

describe("seedWeight", () => {
  it("is 1 for a favorite made now and 0.5 after one half-life", () => {
    expect(seedWeight(NOW, NOW, 90)).toBeCloseTo(1, 10);
    const halfLifeAgo = new Date(NOW.getTime() - 90 * DAY_MS);
    expect(seedWeight(halfLifeAgo, NOW, 90)).toBeCloseTo(0.5, 10);
  });

  it("clamps future timestamps to weight 1", () => {
    const future = new Date(NOW.getTime() + DAY_MS);
    expect(seedWeight(future, NOW, 90)).toBe(1);
  });
});

describe("selectSeeds", () => {
  it("returns all favorites as seeds when fewer than the recent count", () => {
    const favorites = [favorite(1, 0), favorite(2, 5), favorite(3, 10)];
    const seeds = selectSeeds(favorites, NOW);
    expect(seeds.map((s) => s.postId)).toEqual([1, 2, 3]);
  });

  it("takes the recent stratum verbatim and samples the remainder without duplicates", () => {
    const favorites = Array.from({ length: 100 }, (_, i) => favorite(i + 1, i));
    const seeds = selectSeeds(favorites, NOW, FEED_CONFIG, () => 0.5);

    expect(seeds).toHaveLength(FEED_CONFIG.recentSeedCount + FEED_CONFIG.sampledSeedCount);
    // First 30 favorites (most recent) are always seeds
    const recentIds = seeds.slice(0, FEED_CONFIG.recentSeedCount).map((s) => s.postId);
    expect(recentIds).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    // Sampled seeds come from the older remainder, no duplicates
    const sampledIds = seeds.slice(FEED_CONFIG.recentSeedCount).map((s) => s.postId);
    for (const id of sampledIds) expect(id).toBeGreaterThan(30);
    expect(new Set(seeds.map((s) => s.postId)).size).toBe(seeds.length);
  });

  it("weights decay with age", () => {
    const favorites = [favorite(1, 0), favorite(2, 90), favorite(3, 180)];
    const [a, b, c] = selectSeeds(favorites, NOW);
    expect(a.weight).toBeGreaterThan(b.weight);
    expect(b.weight).toBeGreaterThan(c.weight);
    expect(b.weight).toBeCloseTo(0.5, 5);
  });
});

describe("mergeSeedCandidates", () => {
  const config: FeedConfig = { ...FEED_CONFIG, maxFeedSize: 10 };
  const seed = (postId: number, weight: number) => ({
    postId,
    hash: postId.toString(16).padStart(64, "0"),
    weight,
  });

  it("accumulates scores for candidates reached from multiple seeds", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.8)], idf: [] },
      { seed: seed(2, 1), embedding: [candidate(100, 0.6)], idf: [] },
      { seed: seed(3, 1), embedding: [candidate(200, 0.9)], idf: [] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config);

    const convergent = merged.find((p) => p.id === 100)!;
    const single = merged.find((p) => p.id === 200)!;
    expect(convergent.score).toBeCloseTo(0.7 * (0.8 + 0.6), 10);
    expect(single.score).toBeCloseTo(0.7 * 0.9, 10);
    expect(merged[0].id).toBe(100); // convergent evidence ranks first
  });

  it("normalizes IDF scores per seed and applies the idf weight", () => {
    const contributions: SeedContribution[] = [
      {
        seed: seed(1, 1),
        embedding: [],
        idf: [
          { ...candidate(100, 0), score: 40 },
          { ...candidate(200, 0), score: 10 },
        ],
      },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config);
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.3 * 1.0, 10);
    expect(merged.find((p) => p.id === 200)!.score).toBeCloseTo(0.3 * 0.25, 10);
  });

  it("applies seed recency weights", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 0.5), embedding: [candidate(100, 1)], idf: [] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config);
    expect(merged[0].score).toBeCloseTo(0.5 * 0.7 * 1, 10);
  });

  it("drops excluded candidates", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.9), candidate(200, 0.8)], idf: [] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set([100]), config);
    expect(merged.map((p) => p.id)).toEqual([200]);
  });

  it("caps the feed at maxFeedSize with deterministic ordering", () => {
    const embedding = Array.from({ length: 20 }, (_, i) => candidate(i + 1, 0.5));
    const merged = mergeSeedCandidates(
      [{ seed: seed(1, 1), embedding, idf: [] }],
      new Set(),
      config
    );
    expect(merged).toHaveLength(10);
    // Equal scores tie-break by ascending id
    expect(merged.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
