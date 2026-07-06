import { describe, it, expect } from "vitest";
import {
  FEED_CONFIG,
  seedWeight,
  selectSeeds,
  selectNegativeSeeds,
  mulberry32,
  mergeSeedCandidates,
  dedupeRankedByGroup,
  type FavoriteSeedInput,
  type DismissalSeedInput,
  type SeedContribution,
  type FeedConfig,
  type FeedPost,
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

  it("samples deterministically per rng seed and drifts across seeds", () => {
    const favorites = Array.from({ length: 100 }, (_, i) => favorite(i + 1, i));
    const same1 = selectSeeds(favorites, NOW, FEED_CONFIG, mulberry32(2026));
    const same2 = selectSeeds(favorites, NOW, FEED_CONFIG, mulberry32(2026));
    const other = selectSeeds(favorites, NOW, FEED_CONFIG, mulberry32(1337));

    // Same seed → identical full seed list (stable pagination within a bucket).
    expect(same1.map((s) => s.postId)).toEqual(same2.map((s) => s.postId));

    // The deterministic recent stratum is identical regardless of seed; the
    // sampled tail (older stratum) must differ across seeds (taste drift).
    const tail = (seeds: typeof same1) =>
      seeds.slice(FEED_CONFIG.recentSeedCount).map((s) => s.postId);
    expect(tail(same1)).toHaveLength(FEED_CONFIG.sampledSeedCount);
    expect(tail(same1)).not.toEqual(tail(other));
  });

  it("floors a sampled seed several half-lives old to sampledSeedWeightFloor", () => {
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 1, sampledSeedCount: 1 };
    // fav 2 is 360d old (4 half-lives) → raw weight 2^-4 = 0.0625, well below the floor.
    const seeds = selectSeeds([favorite(1, 0), favorite(2, 360)], NOW, config);
    expect(seeds[1].postId).toBe(2); // the sampled (older-stratum) seed
    expect(seeds[1].weight).toBe(config.sampledSeedWeightFloor);
  });

  it("does NOT floor an old favorite that lands in the recent stratum", () => {
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 2, sampledSeedCount: 1 };
    // fav 2 (360d, raw 0.0625) is inside the recent stratum → keeps its raw decayed weight.
    const seeds = selectSeeds([favorite(1, 0), favorite(2, 360), favorite(3, 720)], NOW, config);
    expect(seeds[1].postId).toBe(2);
    expect(seeds[1].weight).toBeCloseTo(0.0625, 10);
    expect(seeds[1].weight).toBeLessThan(config.sampledSeedWeightFloor);
  });

  it("keeps a sampled seed's raw weight when it exceeds the floor", () => {
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 1, sampledSeedCount: 1 };
    // fav 2 is one half-life old → raw weight 0.5, above the 0.25 floor → unchanged.
    const seeds = selectSeeds([favorite(1, 0), favorite(2, 90)], NOW, config);
    expect(seeds[1].postId).toBe(2);
    expect(seeds[1].weight).toBeCloseTo(0.5, 10);
    expect(seeds[1].weight).toBeGreaterThan(config.sampledSeedWeightFloor);
  });

  it("guarantees every age band contributes a seed regardless of rng (coverage)", () => {
    // 500 older favorites spanning 0-1000 days → 5 equal-count age quintiles by
    // age order (postIds 1-100 newest … 401-500 oldest). No matter the rng seed,
    // every one of the 5 bands must contribute ≥1 sampled seed: old taste eras
    // are never fully starved by recency decay.
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 0 };
    const favorites = Array.from({ length: 500 }, (_, i) => favorite(i + 1, i * 2));
    for (const seed of [2026, 1337, 42]) {
      const seeds = selectSeeds(favorites, NOW, config, mulberry32(seed));
      const quintiles = new Set(seeds.map((s) => Math.floor((s.postId - 1) / 100)));
      expect(quintiles).toEqual(new Set([0, 1, 2, 3, 4]));
      expect(seeds).toHaveLength(config.sampledSeedCount); // 60 = min(60, 500)
      expect(new Set(seeds.map((s) => s.postId)).size).toBe(seeds.length);
    }
  });

  it("gives each age band exactly its quota when favorites are ample", () => {
    // 100 older favorites → 5 bands of 20; quota = floor(60 / 5) = 12 each, no
    // shortfall, so every band contributes precisely 12.
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 0 };
    const favorites = Array.from({ length: 100 }, (_, i) => favorite(i + 1, i));
    const seeds = selectSeeds(favorites, NOW, config, mulberry32(7));
    const perBand = [0, 0, 0, 0, 0];
    for (const s of seeds) perBand[Math.floor((s.postId - 1) / 20)]++;
    expect(perBand).toEqual([12, 12, 12, 12, 12]);
    expect(seeds).toHaveLength(60);
    expect(new Set(seeds.map((s) => s.postId)).size).toBe(60);
  });

  it("takes all members of an undersized band and caps the total at older.length", () => {
    // 6 older favorites → bands sized 1,1,1,1,2 (last band absorbs the
    // remainder); every band is below its quota of 12, so all 6 are taken with
    // no duplicates. The 2-member oldest band (postIds 5, 6) is fully present.
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 0 };
    const favorites = Array.from({ length: 6 }, (_, i) => favorite(i + 1, i));
    const seeds = selectSeeds(favorites, NOW, config, mulberry32(9));
    expect(seeds).toHaveLength(6); // min(60, 6)
    expect(seeds.map((s) => s.postId).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(seeds.map((s) => s.postId)).size).toBe(6);
  });

  it("redistributes the global shortfall from the remaining older favorites", () => {
    // 59 older favorites → bands 11,11,11,11,15; quota 12. The four 11-member
    // bands take all 11 (one below quota apiece); the 15-member band takes its
    // quota of 12 and keeps 3 in reserve. That leaves the per-band pass at 56,
    // so reaching min(60, 59) = 59 REQUIRES a global shortfall of 3 drawn from
    // the pooled leftovers — here the whole 3-member reserve — so every favorite
    // ends up sampled exactly once.
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 0 };
    const favorites = Array.from({ length: 59 }, (_, i) => favorite(i + 1, i));
    const seeds = selectSeeds(favorites, NOW, config, mulberry32(3));
    expect(seeds).toHaveLength(59);
    expect(seeds.map((s) => s.postId).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 59 }, (_, i) => i + 1)
    );
    expect(new Set(seeds.map((s) => s.postId)).size).toBe(59);
  });

  it("produces identical output for the same rng seed through the stratified path", () => {
    // Determinism must survive the band + shortfall passes, not just a single
    // weighted draw: a 59-favorite pool exercises both.
    const config: FeedConfig = { ...FEED_CONFIG, recentSeedCount: 0 };
    const favorites = Array.from({ length: 59 }, (_, i) => favorite(i + 1, i));
    const a = selectSeeds(favorites, NOW, config, mulberry32(2026));
    const b = selectSeeds(favorites, NOW, config, mulberry32(2026));
    expect(a.map((s) => s.postId)).toEqual(b.map((s) => s.postId));
    expect(a.map((s) => s.weight)).toEqual(b.map((s) => s.weight));
  });
});

describe("selectNegativeSeeds", () => {
  function dismissal(postId: number, ageDays: number): DismissalSeedInput {
    return {
      postId,
      hash: postId.toString(16).padStart(64, "0"),
      dismissedAt: new Date(NOW.getTime() - ageDays * DAY_MS),
    };
  }

  it("takes the most-recent dismissals up to negativeSeedCount", () => {
    const config: FeedConfig = { ...FEED_CONFIG, negativeSeedCount: 2 };
    const dismissals = [dismissal(1, 0), dismissal(2, 1), dismissal(3, 2)];
    const seeds = selectNegativeSeeds(dismissals, NOW, config);
    expect(seeds.map((s) => s.postId)).toEqual([1, 2]);
  });

  it("weights decay with age at the negative half-life", () => {
    const config: FeedConfig = { ...FEED_CONFIG, negativeRecencyHalfLifeDays: 60 };
    const [a, b] = selectNegativeSeeds([dismissal(1, 0), dismissal(2, 60)], NOW, config);
    expect(a.weight).toBeCloseTo(1, 10);
    expect(b.weight).toBeCloseTo(0.5, 10);
  });

  it("returns nothing when negative seeding is disabled", () => {
    const config: FeedConfig = { ...FEED_CONFIG, negativeSeedCount: 0 };
    expect(selectNegativeSeeds([dismissal(1, 0)], NOW, config)).toEqual([]);
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

  it("subtracts a negative seed's contribution scaled by negativeStrength", () => {
    // Candidate 100 is pulled by a favorite (+) and pushed by a dislike (-).
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 1)], idf: [], polarity: 1 },
      { seed: seed(2, 1), embedding: [candidate(100, 0.5)], idf: [], polarity: -1 },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), {
      ...config,
      negativeStrength: 0.8,
    });
    // +0.7*1  -  0.8*0.7*0.5  = 0.7 - 0.28 = 0.42
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.42, 10);
  });

  it("drops a candidate whose dislike outweighs its like", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.3)], idf: [], polarity: 1 },
      { seed: seed(2, 1), embedding: [candidate(100, 1)], idf: [], polarity: -1 },
    ];
    // +0.7*0.3 = 0.21  vs  -0.8*0.7*1 = -0.56 → net negative → dropped.
    const merged = mergeSeedCandidates(contributions, new Set(), {
      ...config,
      negativeStrength: 0.8,
    });
    expect(merged.find((p) => p.id === 100)).toBeUndefined();
  });

  it("suppresses a candidate reached only from a negative seed", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.9)], idf: [], polarity: 1 },
      { seed: seed(2, 1), embedding: [candidate(200, 0.9)], idf: [], polarity: -1 },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config);
    // Only the liked candidate survives; the disliked-only one is net-negative.
    expect(merged.map((p) => p.id)).toEqual([100]);
  });

  it("treats an omitted polarity as positive (backwards compatible)", () => {
    const withField: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.8)], idf: [], polarity: 1 },
    ];
    const without: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.8)], idf: [] },
    ];
    const a = mergeSeedCandidates(withField, new Set(), config);
    const b = mergeSeedCandidates(without, new Set(), config);
    expect(a).toEqual(b);
  });
});

describe("dedupeRankedByGroup", () => {
  const post = (id: number, score: number): FeedPost => ({
    id,
    hash: id.toString(16).padStart(64, "0"),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    score,
  });

  it("preserves ranked order when nothing is grouped", () => {
    const posts = [post(1, 0.9), post(2, 0.8), post(3, 0.7)];
    const result = dedupeRankedByGroup(posts, new Map());
    expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("drops the lower-scored sibling and keeps the group's first representative", () => {
    const posts = [post(1, 0.9), post(2, 0.8), post(3, 0.7)];
    const groups = new Map<number, number[]>([
      [1, [10]],
      [3, [10]],
    ]);
    const result = dedupeRankedByGroup(posts, groups);
    // 1 represents group 10; 3 (same group, lower score) drops; 2 is ungrouped.
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });

  it("drops a multi-group post if ANY of its groups was already seen", () => {
    const posts = [post(1, 0.9), post(2, 0.8), post(3, 0.7)];
    const groups = new Map<number, number[]>([
      [1, [10]],
      [2, [20]],
      [3, [20, 30]], // shares group 20 with post 2
    ]);
    const result = dedupeRankedByGroup(posts, groups);
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });

  it("keeps a post whose groups are all unseen even alongside grouped ones", () => {
    const posts = [post(1, 0.9), post(2, 0.8), post(3, 0.7)];
    const groups = new Map<number, number[]>([
      [1, [10]],
      [3, [30]],
    ]);
    // 2 is ungrouped, 3's group 30 is fresh → all three survive.
    const result = dedupeRankedByGroup(posts, groups);
    expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
  });
});
