import { describe, it, expect } from "vitest";
import {
  FEED_CONFIG,
  seedWeight,
  selectSeeds,
  selectNegativeSeeds,
  selectViewSeeds,
  mulberry32,
  mergeSeedCandidates,
  dedupeRankedByGroup,
  collapseSignalsByGroup,
  applyViewedPenalty,
  applyFreshnessBoost,
  type FavoriteSeedInput,
  type DismissalSeedInput,
  type ViewSeedInput,
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

describe("selectViewSeeds", () => {
  function view(postId: number, ageDays: number, viewCount: number): ViewSeedInput {
    return {
      postId,
      hash: postId.toString(16).padStart(64, "0"),
      viewCount,
      lastViewedAt: new Date(NOW.getTime() - ageDays * DAY_MS),
    };
  }

  it("takes the most-recently-viewed posts up to viewSeedCount", () => {
    const config: FeedConfig = { ...FEED_CONFIG, viewSeedCount: 2 };
    const seeds = selectViewSeeds(
      [view(1, 0, 1), view(2, 1, 1), view(3, 2, 1)],
      NOW,
      config
    );
    expect(seeds.map((s) => s.postId)).toEqual([1, 2]);
  });

  it("keeps a single fresh view well below a fresh favorite's weight", () => {
    // A favorite made now weighs 1; a single fresh view must be a gentle nudge.
    const [seed] = selectViewSeeds([view(1, 0, 1)], NOW, FEED_CONFIG);
    expect(seed.weight).toBeGreaterThan(0);
    expect(seed.weight).toBeLessThan(FEED_CONFIG.viewWeightCap);
    expect(seed.weight).toBeLessThan(0.5);
  });

  it("weights a repeatedly-viewed post above a once-viewed one", () => {
    const [once, many] = selectViewSeeds([view(1, 0, 1), view(2, 0, 20)], NOW, FEED_CONFIG);
    expect(many.weight).toBeGreaterThan(once.weight);
    // Saturates at the cap for a fresh, heavily-viewed post.
    expect(many.weight).toBeCloseTo(FEED_CONFIG.viewWeightCap, 10);
  });

  it("decays view weight with recency", () => {
    const config: FeedConfig = { ...FEED_CONFIG, viewRecencyHalfLifeDays: 30 };
    const [fresh, old] = selectViewSeeds([view(1, 0, 4), view(2, 30, 4)], NOW, config);
    expect(old.weight).toBeCloseTo(fresh.weight / 2, 10);
  });

  it("returns nothing when view seeding is disabled", () => {
    expect(selectViewSeeds([view(1, 0, 3)], NOW, { ...FEED_CONFIG, viewSeedCount: 0 })).toEqual([]);
    expect(selectViewSeeds([view(1, 0, 3)], NOW, { ...FEED_CONFIG, viewWeightCap: 0 })).toEqual([]);
  });
});

describe("mergeSeedCandidates", () => {
  const config: FeedConfig = { ...FEED_CONFIG, maxFeedSize: 10 };
  const seed = (postId: number, weight: number) => ({
    postId,
    hash: postId.toString(16).padStart(64, "0"),
    weight,
  });
  /** Posts (seeds and candidates) that have a stored embedding. */
  const embedded = (...postIds: number[]) => new Set(postIds);

  const convergenceFixture = (): SeedContribution[] => {
    const contribution = (seedId: number, candidateId: number, score: number): SeedContribution => ({
      seed: seed(seedId, 1),
      embedding: [candidate(candidateId, score)],
      idf: [candidate(candidateId, score)],
    });

    return [
      contribution(1, 100, 0.3),
      contribution(2, 100, 0.3),
      contribution(3, 100, 0.3),
      contribution(4, 100, 0.3),
      contribution(5, 200, 0.55),
      contribution(6, 200, 0.55),
    ];
  };

  it("discounts positive convergence so a focused candidate outranks a weak hub", () => {
    const merged = mergeSeedCandidates(
      convergenceFixture(),
      new Set(),
      { ...config, convergenceDiscount: 0.8 },
      embedded(1, 2, 3, 4, 5, 6, 100, 200)
    );

    const weakHub = merged.find((p) => p.id === 100)!;
    const focused = merged.find((p) => p.id === 200)!;
    expect(merged.map((p) => p.id).slice(0, 2)).toEqual([200, 100]);
    expect(focused.score).toBeCloseTo(0.55 * (1 + 0.8), 10);
    expect(weakHub.score).toBeCloseTo(0.3 * (1 + 0.8 + 0.8 ** 2 + 0.8 ** 3), 10);
  });

  it("keeps convergenceDiscount 1 equivalent to the linear positive sum", () => {
    const merged = mergeSeedCandidates(
      convergenceFixture(),
      new Set(),
      { ...config, convergenceDiscount: 1 },
      embedded(1, 2, 3, 4, 5, 6, 100, 200)
    );

    expect(merged.map((p) => p.id).slice(0, 2)).toEqual([100, 200]);
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.3 * 4, 10);
    expect(merged.find((p) => p.id === 200)!.score).toBeCloseTo(0.55 * 2, 10);
  });

  it("blends IDF cosine scores directly at the idf weight (no per-seed max normalization)", () => {
    // Tag scores are cosines in [0,1] (migration 20260707120000): a seed whose
    // best tag match is weak (0.2) must NOT be inflated to look like a seed
    // with a near-duplicate best match — scores blend as-is.
    const contributions: SeedContribution[] = [
      {
        seed: seed(1, 1),
        embedding: [],
        idf: [candidate(100, 0.8), candidate(200, 0.2)],
      },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config, embedded(1, 100, 200));
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.3 * 0.8, 10);
    expect(merged.find((p) => p.id === 200)!.score).toBeCloseTo(0.3 * 0.2, 10);
  });

  it("clamps out-of-range IDF scores defensively", () => {
    const contributions: SeedContribution[] = [
      {
        seed: seed(1, 1),
        embedding: [],
        idf: [
          { ...candidate(100, 0), score: 40 }, // pre-cosine cache row / bad data
          { ...candidate(200, 0), score: -1 },
        ],
      },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config, embedded(1, 100, 200));
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.3 * 1, 10);
    expect(merged.find((p) => p.id === 200)).toBeUndefined(); // clamped to 0 → no contribution
  });

  it("renormalizes embedding-less candidates by the tag-only achievable weight", () => {
    // Identical evidence from an embedded seed: one embedded candidate, one
    // embedding-less candidate (video / not yet embedded), each reached only
    // through the tag engine with the same cosine. The embedding-less pair
    // can NEVER earn embedding contributions, so it divides by idfWeight
    // alone instead of the full channel weight.
    const video = { ...candidate(200, 0.6), mimeType: "video/mp4" };
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [], idf: [candidate(100, 0.6), video] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config, embedded(1, 100));
    const image = merged.find((p) => p.id === 100)!;
    const clip = merged.find((p) => p.id === 200)!;
    expect(image.score).toBeCloseTo((0.3 * 0.6) / (0.3 + 0.7), 10);
    expect(clip.score).toBeCloseTo((0.3 * 0.6) / 0.3, 10);
    expect(clip.score).toBeGreaterThan(image.score); // tag-only evidence, full channel
  });

  it("treats a pair as tag-only when the SEED lacks an embedding", () => {
    // An embedded image candidate reached only through an embedding-less
    // seed's tag similarity: that seed could never have produced embedding
    // evidence, so the pair divides by idfWeight — identical to a video
    // candidate with the same cosine, NOT penalized by the full channel
    // weight just because another seed in the feed has embeddings.
    const video = { ...candidate(200, 0.6), mimeType: "video/mp4" };
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [], idf: [candidate(100, 0.6), video] },
    ];
    // Candidate 100 is embedded, but seed 1 is not.
    const merged = mergeSeedCandidates(contributions, new Set(), config, embedded(100));
    const image = merged.find((p) => p.id === 100)!;
    const clip = merged.find((p) => p.id === 200)!;
    expect(image.score).toBeCloseTo((0.3 * 0.6) / 0.3, 10);
    expect(image.score).toBeCloseTo(clip.score, 10);
  });

  it("rescales uniformly (ranking-neutral) when embeddings are inactive", () => {
    const contributions: SeedContribution[] = [
      {
        seed: seed(1, 1),
        embedding: [],
        idf: [candidate(100, 0.9), { ...candidate(200, 0.3), mimeType: "video/mp4" }],
      },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config, null);
    // Every pair is tag-only → all divide by idfWeight; order by cosine.
    expect(merged.map((p) => p.id)).toEqual([100, 200]);
    expect(merged[0].score).toBeCloseTo(0.9, 10);
    expect(merged[1].score).toBeCloseTo(0.3, 10);
  });

  it("applies seed recency weights", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 0.5), embedding: [candidate(100, 1)], idf: [] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set(), config, embedded(1, 100));
    expect(merged[0].score).toBeCloseTo(0.5 * 0.7 * 1, 10);
  });

  it("drops excluded candidates", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 0.9), candidate(200, 0.8)], idf: [] },
    ];
    const merged = mergeSeedCandidates(contributions, new Set([100]), config);
    expect(merged.map((p) => p.id)).toEqual([200]);
  });

  it("does not cap merged candidates before downstream dedupe and final slicing", () => {
    const embedding = Array.from({ length: 20 }, (_, i) => candidate(i + 1, 0.5));
    const merged = mergeSeedCandidates(
      [{ seed: seed(1, 1), embedding, idf: [] }],
      new Set(),
      config
    );
    expect(merged).toHaveLength(20);
    // Equal scores tie-break by ascending id, but the whole ranked candidate
    // pool remains available for later group collapse and final slicing.
    expect(merged.map((p) => p.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("subtracts a negative seed's contribution scaled by negativeStrength", () => {
    // Candidate 100 is pulled by a favorite (+) and pushed by a dislike (-).
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 1)], idf: [], polarity: 1 },
      { seed: seed(2, 1), embedding: [candidate(100, 0.5)], idf: [], polarity: -1 },
    ];
    const merged = mergeSeedCandidates(
      contributions,
      new Set(),
      { ...config, negativeStrength: 0.8 },
      embedded(1, 2, 100)
    );
    // +0.7*1  -  0.8*0.7*0.5  = 0.7 - 0.28 = 0.42
    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(0.42, 10);
  });

  it("keeps multiple negative seed contributions linear under convergence discount", () => {
    const contributions: SeedContribution[] = [
      { seed: seed(1, 1), embedding: [candidate(100, 1)], idf: [], polarity: 1 },
      { seed: seed(2, 1), embedding: [candidate(100, 0.3)], idf: [], polarity: -1 },
      { seed: seed(3, 1), embedding: [candidate(100, 0.3)], idf: [], polarity: -1 },
    ];
    const merged = mergeSeedCandidates(
      contributions,
      new Set(),
      { ...config, convergenceDiscount: 0.8, embeddingWeight: 1, idfWeight: 0, negativeStrength: 1 },
      embedded(1, 2, 3, 100)
    );

    expect(merged.find((p) => p.id === 100)!.score).toBeCloseTo(1 - 0.3 - 0.3, 10);
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

describe("feed ranking pipeline", () => {
  const config: FeedConfig = {
    ...FEED_CONFIG,
    embeddingWeight: 1,
    idfWeight: 0,
    maxFeedSize: 3,
  };
  const seed = (postId: number, weight: number) => ({
    postId,
    hash: postId.toString(16).padStart(64, "0"),
    weight,
  });
  const embedded = (...postIds: number[]) => new Set(postIds);

  it("dedupes before the final slice so collapsed groups do not leave holes", () => {
    const merged = mergeSeedCandidates(
      [
        {
          seed: seed(99, 1),
          embedding: [
            candidate(1, 0.99),
            candidate(2, 0.98),
            candidate(3, 0.97),
            candidate(4, 0.96),
            candidate(5, 0.95),
            candidate(6, 0.94),
          ],
          idf: [],
        },
      ],
      new Set(),
      config,
      embedded(99, 1, 2, 3, 4, 5, 6)
    );
    const groupIdsByPostId = new Map<number, number[]>([
      [1, [10]],
      [2, [10]],
      [3, [10]],
    ]);

    const final = dedupeRankedByGroup(merged, groupIdsByPostId).slice(0, config.maxFeedSize);

    expect(final).toHaveLength(config.maxFeedSize);
    expect(final.map((p) => p.id)).toEqual([1, 4, 5]);
  });
});

describe("collapseSignalsByGroup", () => {
  const signal = (postId: number) => ({ postId });

  it("keeps everything when nothing is grouped", () => {
    const signals = [signal(1), signal(2), signal(3)];
    expect(collapseSignalsByGroup(signals, new Map())).toEqual(signals);
  });

  it("collapses a multi-page set to its first (newest) member", () => {
    // Signals arrive newest-first; pages 1-3 of one set + an ungrouped post.
    const signals = [signal(1), signal(2), signal(3), signal(4)];
    const groups = new Map<number, number[]>([
      [1, [10]],
      [2, [10]],
      [3, [10]],
    ]);
    expect(collapseSignalsByGroup(signals, groups).map((s) => s.postId)).toEqual([1, 4]);
  });

  it("drops a signal when ANY of its groups was already claimed", () => {
    const signals = [signal(1), signal(2)];
    const groups = new Map<number, number[]>([
      [1, [10]],
      [2, [20, 10]],
    ]);
    expect(collapseSignalsByGroup(signals, groups).map((s) => s.postId)).toEqual([1]);
  });

  it("threads one seen-set across signal lists so later lists defer to earlier ones", () => {
    // A favorite claims group 10; a viewed sibling page of the same set is
    // redundant with that favorite seed and collapses away.
    const groups = new Map<number, number[]>([
      [1, [10]],
      [7, [10]],
    ]);
    const seen = new Set<number>();
    const favorites = collapseSignalsByGroup([signal(1)], groups, seen);
    const views = collapseSignalsByGroup([signal(7), signal(8)], groups, seen);
    expect(favorites.map((s) => s.postId)).toEqual([1]);
    expect(views.map((s) => s.postId)).toEqual([8]);
  });

  it("keeps signals collapsed with independent seen-sets separate (polarity isolation)", () => {
    // A dismissal inside a favorited set keeps its own (negative) seed.
    const groups = new Map<number, number[]>([
      [1, [10]],
      [7, [10]],
    ]);
    const favorites = collapseSignalsByGroup([signal(1)], groups);
    const dismissals = collapseSignalsByGroup([signal(7)], groups);
    expect(favorites.map((s) => s.postId)).toEqual([1]);
    expect(dismissals.map((s) => s.postId)).toEqual([7]);
  });

  it("preserves input order and extra fields", () => {
    const signals = [
      { postId: 5, weightMarker: "a" },
      { postId: 6, weightMarker: "b" },
    ];
    const result = collapseSignalsByGroup(signals, new Map());
    expect(result).toEqual(signals);
  });
});

describe("applyFreshnessBoost", () => {
  const NOW_ = new Date("2026-07-03T00:00:00Z");
  const post = (id: number, score: number): FeedPost => ({
    id,
    hash: id.toString(16).padStart(64, "0"),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    score,
  });
  const createdAt = (ageDays: number) => new Date(NOW_.getTime() - ageDays * DAY_MS);

  it("boosts fresh posts by recency, leaves missing timestamps unchanged, and sorts by score then id", () => {
    const config: FeedConfig = {
      ...FEED_CONFIG,
      freshnessBoost: 0.15,
      freshnessHalfLifeDays: 7,
    };
    const posts = [post(4, 1.1), post(2, 1), post(3, 1.1), post(1, 1)];
    const result = applyFreshnessBoost(
      posts,
      new Map([
        [1, createdAt(0)],
        [2, createdAt(7)],
      ]),
      NOW_,
      config
    );

    expect(result.map((p) => p.id)).toEqual([1, 3, 4, 2]);
    expect(result.find((p) => p.id === 1)!.score).toBeCloseTo(1.15, 10);
    expect(result.find((p) => p.id === 2)!.score).toBeCloseTo(1.075, 10);
    expect(result.find((p) => p.id === 3)!.score).toBe(1.1);
    expect(result.find((p) => p.id === 4)!.score).toBe(1.1);
    expect(posts.map((p) => p.score)).toEqual([1.1, 1, 1.1, 1]);
  });
});

describe("applyViewedPenalty", () => {
  const NOW_ = new Date("2026-07-03T00:00:00Z");
  const post = (id: number, score: number): FeedPost => ({
    id,
    hash: id.toString(16).padStart(64, "0"),
    width: 100,
    height: 100,
    blurhash: null,
    mimeType: "image/png",
    score,
  });
  const viewedAt = (ageDays: number) => new Date(NOW_.getTime() - ageDays * DAY_MS);

  it("leaves unviewed posts untouched", () => {
    const posts = [post(1, 0.9), post(2, 0.8)];
    const result = applyViewedPenalty(posts, new Map(), NOW_, FEED_CONFIG);
    expect(result).toEqual(posts);
  });

  it("scales a freshly viewed post down to the penalty floor and re-ranks", () => {
    const posts = [post(1, 0.9), post(2, 0.5)];
    const result = applyViewedPenalty(posts, new Map([[1, viewedAt(0)]]), NOW_, FEED_CONFIG);
    const viewed = result.find((p) => p.id === 1)!;
    expect(viewed.score).toBeCloseTo(0.9 * FEED_CONFIG.viewedCandidatePenaltyFloor, 10);
    // 0.9 * 0.3 = 0.27 < 0.5 → the unviewed post now ranks first.
    expect(result.map((p) => p.id)).toEqual([2, 1]);
  });

  it("relaxes the penalty back toward 1 as the view ages", () => {
    const config: FeedConfig = { ...FEED_CONFIG, viewRecencyHalfLifeDays: 30 };
    const posts = [post(1, 1)];
    const fresh = applyViewedPenalty(posts, new Map([[1, viewedAt(0)]]), NOW_, config)[0];
    const halfLife = applyViewedPenalty(posts, new Map([[1, viewedAt(30)]]), NOW_, config)[0];
    const ancient = applyViewedPenalty(posts, new Map([[1, viewedAt(3000)]]), NOW_, config)[0];
    // floor 0.3: fresh → 0.3; one half-life → 1 - 0.7*0.5 = 0.65; ancient → ~1.
    expect(fresh.score).toBeCloseTo(0.3, 10);
    expect(halfLife.score).toBeCloseTo(0.65, 10);
    expect(ancient.score).toBeGreaterThan(0.99);
  });

  it("is disabled entirely at floor >= 1", () => {
    const config: FeedConfig = { ...FEED_CONFIG, viewedCandidatePenaltyFloor: 1 };
    const posts = [post(1, 0.9)];
    const result = applyViewedPenalty(posts, new Map([[1, viewedAt(0)]]), NOW_, config);
    expect(result).toBe(posts); // same reference: no-op
  });

  it("does not mutate the input posts", () => {
    const posts = [post(1, 0.9)];
    applyViewedPenalty(posts, new Map([[1, viewedAt(0)]]), NOW_, FEED_CONFIG);
    expect(posts[0].score).toBe(0.9);
  });
});
