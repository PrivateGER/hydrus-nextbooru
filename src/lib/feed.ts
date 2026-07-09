/**
 * "For You" feed engine.
 *
 * Multi-seed k-NN aggregation: each favorited post seeds two candidate
 * neighborhoods — image-embedding nearest neighbors (pgvector) and the
 * IDF-weighted tag COSINE similarity (the PostRecommendation engine, both
 * scores in [0,1]). Candidates are merged with recency-decayed seed weights;
 * convergent evidence (a candidate reached from several seeds) accumulates
 * score, each contribution renormalized by the engine weight its
 * seed/candidate pair could actually earn (an embedding-less post on either
 * end makes the pair tag-only). Taste signals collapse to one seed per group,
 * and already-viewed candidates are downweighted with a decaying penalty.
 *
 * The pure functions (seed selection, group collapse, score merging, viewed
 * penalty) live at the top and are unit-tested; DB/build plumbing follows.
 */

import type { RecommendedPost } from "@/lib/recommendations";
import {
  type EmbeddedRelatedPost,
  findRelatedPostsByEmbeddingForPosts,
} from "@/lib/embeddings/store";
import { prisma } from "@/lib/db";
import { feedLog } from "@/lib/logger";
import { getTagNeighborhoodsForSeeds } from "@/lib/recommendations";
import {
  getEmbeddingOpenRouterSettings,
  toEmbeddingConfig,
  type EmbeddingConfig,
} from "@/lib/embeddings/settings";

export interface FeedConfig {
  /** Most recent favorites always used as seeds (current taste). */
  recentSeedCount: number;
  /** Older favorites sampled with recency-decayed probability (long-term taste). */
  sampledSeedCount: number;
  /**
   * The older stratum is split into this many equal-count age bands, each
   * guaranteed a share of the sampled seeds, so old taste eras cannot be
   * starved by recency decay.
   */
  seedAgeBands: number;
  /** Neighbors fetched per seed per engine (engines cap at 20). */
  neighborsPerSeed: number;
  /** Blend weight for embedding similarity. */
  embeddingWeight: number;
  /** Blend weight for IDF tag similarity. */
  idfWeight: number;
  /** Seed weight halves every this many days since the favorite. */
  recencyHalfLifeDays: number;
  /** Minimum cosine similarity for embedding candidates. */
  minEmbeddingScore: number;
  /**
   * Contribution-weight floor for sampled (older-stratum) seeds: sampled seeds
   * already paid the recency penalty at selection; the floor gives long-term
   * taste a real voice in ranking.
   */
  sampledSeedWeightFloor: number;
  /**
   * Most-recent dismissals ("not interested") used as NEGATIVE seeds. Their
   * tag/embedding neighborhoods subtract from candidate scores, so disliking a
   * post pushes down posts similar to it — not just that one post.
   */
  negativeSeedCount: number;
  /** Negative-seed weight halves every this many days since the dismissal. */
  negativeRecencyHalfLifeDays: number;
  /**
   * How hard a dislike pushes similar posts down, relative to how hard a like
   * pulls them up. 1 = symmetric; < 1 keeps the negative signal from steam-
   * rolling positive taste.
   */
  negativeStrength: number;
  /**
   * Most-recently-viewed posts used as weak POSITIVE seeds (implicit
   * engagement). Excludes favorited/dismissed posts — those already carry a
   * stronger explicit signal.
   */
  viewSeedCount: number;
  /** View-seed weight halves every this many days since the last view. */
  viewRecencyHalfLifeDays: number;
  /**
   * Ceiling on a single view seed's weight, reached by a freshly, repeatedly
   * viewed post. Kept well below 1 (a fresh favorite) so a passive view never
   * outweighs a deliberate favorite.
   */
  viewWeightCap: number;
  /**
   * viewCount at which the count factor saturates to ~1. The factor grows with
   * log(viewCount), so the 2nd open of a post lifts its weight far more than
   * the 20th.
   */
  viewCountSaturation: number;
  /**
   * Residual score multiplier for a candidate the user JUST viewed. A viewed
   * candidate's merged score is scaled by a factor that starts at this floor
   * for a fresh view and decays back to 1 as the view ages (at
   * viewRecencyHalfLifeDays), so the feed stops re-serving what the user
   * already opened without permanently burying it. 1 disables the penalty.
   */
  viewedCandidatePenaltyFloor: number;
  /**
   * Geometric discount for additional positive seeds reaching the same
   * candidate: 1 preserves linear accumulation; lower values reward focused
   * agreement without letting generic hubs compound across many weak seeds.
   */
  convergenceDiscount: number;
  /**
   * Maximum fractional score lift for a just-imported candidate. Kept small so
   * freshness creates a first-look window without overriding relevance.
   */
  freshnessBoost: number;
  /** Freshness boost halves every this many days since import. */
  freshnessHalfLifeDays: number;
  /** Ranked feed length cap. */
  maxFeedSize: number;
}

export const FEED_CONFIG: FeedConfig = {
  recentSeedCount: 30,
  sampledSeedCount: 60,
  seedAgeBands: 5,
  neighborsPerSeed: 20,
  embeddingWeight: 0.7,
  idfWeight: 0.3,
  recencyHalfLifeDays: 90,
  minEmbeddingScore: 0.25,
  sampledSeedWeightFloor: 0.25,
  negativeSeedCount: 30,
  negativeRecencyHalfLifeDays: 60,
  negativeStrength: 0.8,
  viewSeedCount: 25,
  viewRecencyHalfLifeDays: 30,
  viewWeightCap: 0.35,
  viewCountSaturation: 8,
  viewedCandidatePenaltyFloor: 0.3,
  convergenceDiscount: 0.8,
  freshnessBoost: 0.15,
  freshnessHalfLifeDays: 7,
  maxFeedSize: 500,
};

export interface FavoriteSeedInput {
  postId: number;
  hash: string;
  favoritedAt: Date;
}

export interface DismissalSeedInput {
  postId: number;
  hash: string;
  dismissedAt: Date;
}

export interface ViewSeedInput {
  postId: number;
  hash: string;
  viewCount: number;
  lastViewedAt: Date;
}

export interface FeedSeed {
  postId: number;
  hash: string;
  weight: number;
}

export interface FeedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  score: number;
}

export interface SeedContribution {
  seed: FeedSeed;
  embedding: EmbeddedRelatedPost[];
  idf: RecommendedPost[];
  /**
   * +1 for a positive seed (favorite / view) whose neighbors are boosted, -1
   * for a negative seed (dismissal) whose neighbors are suppressed. Defaults to
   * +1 when omitted.
   */
  polarity?: 1 | -1;
}

const DAY_MS = 86_400_000;

/**
 * Over-fetch factor for the bounded seed-signal reads (recent views and
 * dismissals). Group collapse runs AFTER the fetch, so fetching exactly
 * seed-count rows would let one freshly-viewed/dismissed multi-page set
 * collapse the whole window into a single seed while older unrelated signals
 * were never fetched. Fetching a few multiples keeps the window meaningful
 * even when sets dominate the newest rows; the seed selectors still cap the
 * final seed counts (selectViewSeeds / selectNegativeSeeds slice to their
 * configured counts), so this only widens the candidate window — reads stay
 * bounded and index-served. Favorites are unaffected (loaded in full).
 */
const SEED_COLLAPSE_OVERFETCH = 4;

/**
 * Time-bucket width for the seed sampler's PRNG seed. Builds within the same
 * bucket reseed mulberry32 identically, so the 60 sampled older seeds — and
 * thus feed order — stay stable across a session's page requests; the seed
 * changes each bucket so the sampled tail drifts over time (taste
 * exploration). 5 minutes trades a little cross-bucket churn for pagination
 * that holds still while a user scrolls.
 */
const SEED_SAMPLE_BUCKET_MS = 300_000;

/**
 * Deterministic 32-bit PRNG (mulberry32). Seeded, so a given seed reproduces
 * the same stream — used to make seed sampling stable within a time bucket.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exponential recency decay: 1 at age 0, 0.5 after one half-life. */
export function seedWeight(favoritedAt: Date, now: Date, halfLifeDays: number): number {
  const ageDays = Math.max(0, (now.getTime() - favoritedAt.getTime()) / DAY_MS);
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}

interface WeightedFavorite {
  fav: FavoriteSeedInput;
  weight: number;
}

/**
 * Weighted sampling WITHOUT replacement: draws up to `count` favorites from
 * `pool` with probability proportional to each entry's recency weight,
 * splicing out every pick so it cannot be drawn twice. Deterministic for a
 * given `rng`; yields fewer than `count` only when the pool runs dry. Mutates
 * `pool` — the leftovers are reused for the cross-band shortfall pass.
 */
function sampleWeighted(
  pool: WeightedFavorite[],
  count: number,
  rng: () => number
): FavoriteSeedInput[] {
  const picks: FavoriteSeedInput[] = [];
  const target = Math.min(count, pool.length);
  while (picks.length < target) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * totalWeight;
    let picked = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        picked = i;
        break;
      }
    }
    picks.push(pool[picked].fav);
    pool.splice(picked, 1);
  }
  return picks;
}

/**
 * Collapse a taste-signal list (favorites / views / dismissals) to one
 * representative per group BEFORE seed selection.
 *
 * Without this, favoriting a 30-page Pixiv set puts up to 30 near-identical
 * posts into the recent-seed slots — each with full weight and an essentially
 * identical neighborhood — so a single set contributes ~30x convergent
 * evidence and monopolizes the feed. Candidate-side group dedup cannot fix
 * that: the ballot box is stuffed at the seed level.
 *
 * Walking in the given order (callers pass newest-first, so the newest member
 * represents the group), a signal is dropped when ANY of its groups was
 * already claimed by an earlier kept signal. Ungrouped signals always pass.
 *
 * `seenGroups` is mutated so callers can thread one set through several
 * signal lists of the SAME polarity (favorites first, then views: a viewed
 * sibling page of a favorited set is redundant with the favorite seed).
 * Negative signals must use their own set — a dismissal of one page of an
 * otherwise-liked set is an explicit correction and must not be silenced by
 * the favorite having claimed the group.
 */
export function collapseSignalsByGroup<T extends { postId: number }>(
  signals: readonly T[],
  groupIdsByPostId: ReadonlyMap<number, number[]>,
  seenGroups: Set<number> = new Set()
): T[] {
  const kept: T[] = [];
  for (const signal of signals) {
    const groupIds = groupIdsByPostId.get(signal.postId);
    if (!groupIds || groupIds.length === 0) {
      kept.push(signal);
      continue;
    }
    if (groupIds.some((id) => seenGroups.has(id))) continue;
    for (const id of groupIds) seenGroups.add(id);
    kept.push(signal);
  }
  return kept;
}

/**
 * Stratified seed selection.
 *
 * The `recentSeedCount` newest favorites are always seeds (current taste).
 *
 * The older remainder is sampled for long-term taste. Plain uniform weighted
 * sampling starves niche/old interests: with the previous 20 draws a cluster
 * holding 5% of the older stratum's decay-weight was absent from ~36% of
 * builds and a 1% cluster from ~82%. So we (a) widen the sample
 * (`sampledSeedCount`) and (b) guarantee coverage across taste eras. The older
 * favorites (already newest-first) are split into `seedAgeBands` contiguous
 * equal-count age bands, and each band is granted a quota of the sample so
 * recency decay cannot silence an entire era. Within a band, favorites are
 * drawn WITHOUT replacement with probability proportional to their recency
 * weight; a band with fewer members than its quota contributes all of them,
 * and any resulting global shortfall is filled from the union of the remaining
 * unsampled older favorites. The result holds `min(sampledSeedCount,
 * older.length)` sampled seeds, has no duplicates, and is deterministic for a
 * given `rng`.
 *
 * @param favorites - MUST be sorted favoritedAt DESC (newest first)
 * @param rng - injectable for deterministic tests
 */
export function selectSeeds(
  favorites: FavoriteSeedInput[],
  now: Date,
  config: FeedConfig = FEED_CONFIG,
  rng: () => number = Math.random
): FeedSeed[] {
  const recent = favorites.slice(0, config.recentSeedCount);
  const older = favorites.slice(config.recentSeedCount);

  // Age-stratified weighted sampling of the older stratum. Split `older`
  // (newest-first) into `seedAgeBands` contiguous equal-count bands — the last
  // band absorbs the remainder; bands are empty when older.length < bands.
  // Each band gets a quota (floor(sampledSeedCount / bands), the remainder
  // handed one-each to the newest bands) sampled without replacement, so no age
  // era can be starved by recency decay. Undersized bands contribute all their
  // members; the leftover global shortfall is then drawn from the union of
  // everything still unsampled.
  const sampled: FavoriteSeedInput[] = [];
  if (older.length > 0 && config.sampledSeedCount > 0 && config.seedAgeBands > 0) {
    const bandCount = config.seedAgeBands;
    const target = Math.min(config.sampledSeedCount, older.length);
    const bandSize = Math.floor(older.length / bandCount);
    const baseQuota = Math.floor(config.sampledSeedCount / bandCount);
    const quotaRemainder = config.sampledSeedCount - baseQuota * bandCount;

    const bands: WeightedFavorite[][] = [];
    for (let b = 0; b < bandCount; b++) {
      const start = b * bandSize;
      const end = b === bandCount - 1 ? older.length : start + bandSize;
      bands.push(
        older.slice(start, end).map((fav) => ({
          fav,
          weight: seedWeight(fav.favoritedAt, now, config.recencyHalfLifeDays),
        }))
      );
    }

    // Per-band pass: the extra `quotaRemainder` seeds go to the newest bands.
    for (let b = 0; b < bandCount; b++) {
      const quota = baseQuota + (b < quotaRemainder ? 1 : 0);
      sampled.push(...sampleWeighted(bands[b], quota, rng));
    }

    // Fill any global shortfall from the pooled leftovers of every band.
    const shortfall = target - sampled.length;
    if (shortfall > 0) {
      sampled.push(...sampleWeighted(bands.flat(), shortfall, rng));
    }
  }

  // Recent-stratum seeds keep their raw recency-decayed weight. Sampled seeds
  // already paid the recency penalty as selection probability, so charging it
  // again as contribution weight would double-decay them; the floor restores a
  // meaningful long-term-taste voice in ranking.
  const toSeed = (fav: FavoriteSeedInput, floored: boolean): FeedSeed => {
    const raw = seedWeight(fav.favoritedAt, now, config.recencyHalfLifeDays);
    return {
      postId: fav.postId,
      hash: fav.hash,
      weight: floored ? Math.max(raw, config.sampledSeedWeightFloor) : raw,
    };
  };

  return [
    ...recent.map((fav) => toSeed(fav, false)),
    ...sampled.map((fav) => toSeed(fav, true)),
  ];
}

/**
 * Negative-seed selection from dismissals ("not interested").
 *
 * Unlike favorites, dismissals are NOT stratified across taste eras: "not
 * interested" is a short-horizon correction, so we take the `negativeSeedCount`
 * most-recent dismissals with plain recency-decayed weights and let older
 * dislikes fade. A dismissal made now weighs 1; one a half-life old weighs 0.5.
 *
 * @param dismissals - MUST be sorted dismissedAt DESC (newest first)
 */
export function selectNegativeSeeds(
  dismissals: DismissalSeedInput[],
  now: Date,
  config: FeedConfig = FEED_CONFIG
): FeedSeed[] {
  if (config.negativeSeedCount <= 0) return [];
  return dismissals.slice(0, config.negativeSeedCount).map((d) => ({
    postId: d.postId,
    hash: d.hash,
    weight: seedWeight(d.dismissedAt, now, config.negativeRecencyHalfLifeDays),
  }));
}

/**
 * Positive seeds from implicit views (opening a post's detail page).
 *
 * A view is a much softer signal than a deliberate favorite, so its weight is
 * capped well below 1: weight = viewWeightCap * recency(lastViewedAt) *
 * countFactor. countFactor grows with log(viewCount) and saturates at
 * viewCountSaturation, so re-opening a post lifts it (real interest) but a
 * single accidental open stays a gentle nudge. Callers must exclude favorited
 * and dismissed posts upstream — those carry a stronger explicit signal.
 *
 * @param views - MUST be sorted lastViewedAt DESC (newest first)
 */
export function selectViewSeeds(
  views: ViewSeedInput[],
  now: Date,
  config: FeedConfig = FEED_CONFIG
): FeedSeed[] {
  if (config.viewSeedCount <= 0 || config.viewWeightCap <= 0) return [];
  const saturationLog = Math.log(1 + Math.max(0, config.viewCountSaturation));
  return views.slice(0, config.viewSeedCount).map((v) => {
    const recency = seedWeight(v.lastViewedAt, now, config.viewRecencyHalfLifeDays);
    const countFactor =
      saturationLog > 0
        ? Math.min(1, Math.log(1 + Math.max(0, v.viewCount)) / saturationLog)
        : 1;
    return {
      postId: v.postId,
      hash: v.hash,
      weight: config.viewWeightCap * recency * countFactor,
    };
  });
}

/**
 * Merge per-seed candidate neighborhoods into one ranked list.
 *
 * Both engines now emit cosine similarities in [0,1] (clamped defensively):
 * embedding cosine, and the IDF-weighted tag cosine (migration
 * 20260707120000). Tag scores are therefore blended DIRECTLY — the old
 * per-seed max normalization (which inflated every seed's best tag match to
 * 1.0, making a barely-related best match look like a near-duplicate) is
 * gone. For one seed/candidate pair, embedding + tag channels are
 * complementary evidence and remain additive after per-pair achievable-weight
 * normalization.
 *
 * Positive seeds do NOT then add linearly across every seed. For each
 * candidate, positive per-seed contributions are sorted descending and summed
 * with `convergenceDiscount^i`: 1 preserves the old linear sum exactly, while
 * lower values damp generic hubs that are weakly similar to many seeds.
 *
 * Negative seeds (polarity -1, from dismissals) subtract their contribution
 * scaled by `negativeStrength` and stay linear — repeated dislike evidence
 * must not be convergence-discounted. A candidate whose final score lands at
 * or below zero — dominated by dislikes — is dropped from the feed.
 *
 * Each per-seed/channel contribution is renormalized by the engine weight its
 * (seed, candidate) PAIR could possibly have earned: the embedding channel is
 * live only when both the seed and the candidate have a stored embedding
 * (`embeddedPostIds`), so a tag-only contribution over a pair with no
 * possible embedding evidence — video or unembedded post on EITHER end —
 * divides by idfWeight alone instead of idfWeight + embeddingWeight.
 * Without this, such posts compete for feed slots with a hard ~(idfWeight)
 * ceiling against fully-embedded pairs' 1.0 — a systematic media-type /
 * embedding-coverage bias unrelated to relevance. Normalizing per pair (not
 * per candidate from a global flag) matters in mixed feeds: an image reached
 * only through an embedding-less seed's tag similarity must not be penalized
 * for embedding evidence that seed could never produce. When
 * `embeddedPostIds` is null/empty (embeddings unconfigured or store empty)
 * every pair is tag-only and the renormalization is a uniform rescale
 * (ranking unchanged).
 *
 * This returns the full ranked candidate pool. The final `maxFeedSize` slice
 * belongs after freshness, viewed-candidate penalty, and group dedupe.
 */
export function mergeSeedCandidates(
  contributions: SeedContribution[],
  excludedPostIds: ReadonlySet<number>,
  config: FeedConfig = FEED_CONFIG,
  embeddedPostIds: ReadonlySet<number> | null = null
): FeedPost[] {
  type CandidateAccumulator = FeedPost & {
    positiveContributions: number[];
    negativeScore: number;
  };

  const byId = new Map<number, CandidateAccumulator>();

  const ensureCandidate = (
    post: { id: number; hash: string; width: number | null; height: number | null; blurhash: string | null; mimeType: string }
  ): CandidateAccumulator => {
    const existing = byId.get(post.id);
    if (existing) return existing;

    const next: CandidateAccumulator = {
      id: post.id,
      hash: post.hash,
      width: post.width,
      height: post.height,
      blurhash: post.blurhash,
      mimeType: post.mimeType,
      score: 0,
      positiveContributions: [],
      negativeScore: 0,
    };
    byId.set(post.id, next);
    return next;
  };

  for (const { seed, embedding, idf, polarity = 1 } of contributions) {
    const perSeed = new Map<
      number,
      {
        post: { id: number; hash: string; width: number | null; height: number | null; blurhash: string | null; mimeType: string };
        score: number;
      }
    >();

    const addPerSeed = (
      post: { id: number; hash: string; width: number | null; height: number | null; blurhash: string | null; mimeType: string },
      contribution: number
    ) => {
      if (contribution === 0 || excludedPostIds.has(post.id)) return;
      const existing = perSeed.get(post.id);
      if (existing) existing.score += contribution;
      else perSeed.set(post.id, { post, score: contribution });
    };

    // The embedding channel is live for a (seed, candidate) PAIR only when
    // BOTH ends have a stored embedding — findRelatedPostsByEmbedding returns
    // nothing for an embedding-less seed no matter the candidate, and an
    // embedding-less candidate can appear in no seed's k-NN results. Each
    // channel contribution divides by ITS pair's achievable weight before the
    // seed's channels are combined.
    const seedEmbedded = embeddedPostIds?.has(seed.postId) ?? false;
    const achievableFor = (candidateId: number): number => {
      const pairEmbedded =
        seedEmbedded && (embeddedPostIds?.has(candidateId) ?? false);
      const achievable =
        config.idfWeight + (pairEmbedded ? config.embeddingWeight : 0);
      // Degenerate configs (idfWeight 0 without embeddings) fall back to the
      // raw contribution rather than dividing by zero.
      return achievable > 0 ? achievable : 1;
    };

    for (const neighbor of embedding) {
      const similarity = Math.max(0, Math.min(1, neighbor.score));
      addPerSeed(
        neighbor,
        (seed.weight * config.embeddingWeight * similarity) /
          achievableFor(neighbor.id)
      );
    }

    for (const rec of idf) {
      const similarity = Math.max(0, Math.min(1, rec.score));
      addPerSeed(
        rec,
        (seed.weight * config.idfWeight * similarity) /
          achievableFor(rec.id)
      );
    }

    const negativeMultiplier = -config.negativeStrength;
    for (const { post, score } of perSeed.values()) {
      const candidate = ensureCandidate(post);
      if (polarity < 0) candidate.negativeScore += negativeMultiplier * score;
      else candidate.positiveContributions.push(score);
    }
  }

  const discount = config.convergenceDiscount;
  return [...byId.values()]
    .map(({ positiveContributions, negativeScore, ...post }) => {
      const positiveScore = positiveContributions
        .sort((a, b) => b - a)
        .reduce((sum, contribution, index) => sum + contribution * discount ** index, 0);
      return { ...post, score: positiveScore + negativeScore };
    })
    .filter((post) => post.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

/**
 * Give newly-imported candidates a small, time-decayed first-look window.
 *
 * Candidates only enter this feed through similarity to established taste, so
 * freshness is a multiplier on relevance rather than an independent ranking
 * source: a just-imported post gets at most `freshnessBoost`, and the boost
 * halves every `freshnessHalfLifeDays`. Missing import timestamps leave posts
 * unchanged.
 */
export function applyFreshnessBoost(
  posts: FeedPost[],
  importedAtByPostId: ReadonlyMap<number, Date>,
  now: Date,
  config: FeedConfig = FEED_CONFIG
): FeedPost[] {
  if (config.freshnessBoost <= 0 || importedAtByPostId.size === 0) return posts;

  return posts
    .map((post) => {
      const importedAt = importedAtByPostId.get(post.id);
      if (!importedAt) return post;
      const ageDays = Math.max(0, (now.getTime() - importedAt.getTime()) / DAY_MS);
      const recency = Math.exp(
        (-Math.LN2 * ageDays) / config.freshnessHalfLifeDays
      );
      return { ...post, score: post.score * (1 + config.freshnessBoost * recency) };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

/**
 * Downweight candidates the user has ALREADY opened.
 *
 * Without this the feed keeps re-serving exactly what the user just looked at
 * — viewed posts stay eligible candidates, and (as view seeds) even pull in
 * more of the same — so the top of the feed accumulates consumed content. A
 * view is interest, not rejection, so this is a decaying penalty rather than
 * an exclusion: a candidate viewed just now keeps only
 * `viewedCandidatePenaltyFloor` of its score, and the factor relaxes back to
 * 1 as the view ages (same half-life as view seeding), letting old favorites
 * of the eye resurface later.
 *
 * Runs before group dedupe and the final `maxFeedSize` slice: penalized posts
 * can now fall out of the returned feed, letting unviewed candidates from the
 * unsliced tail rise in after re-sorting.
 */
export function applyViewedPenalty(
  posts: FeedPost[],
  lastViewedByPostId: ReadonlyMap<number, Date>,
  now: Date,
  config: FeedConfig = FEED_CONFIG
): FeedPost[] {
  const floor = config.viewedCandidatePenaltyFloor;
  if (floor >= 1 || lastViewedByPostId.size === 0) return posts;

  return posts
    .map((post) => {
      const lastViewedAt = lastViewedByPostId.get(post.id);
      if (!lastViewedAt) return post;
      const recency = seedWeight(lastViewedAt, now, config.viewRecencyHalfLifeDays);
      const factor = 1 - (1 - Math.max(0, floor)) * recency;
      return { ...post, score: post.score * factor };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

/**
 * Collapse group siblings in a ranked feed to one representative each.
 *
 * Without this, a multi-page set near the user's taste occupies one feed slot
 * per page. Walking in ranked (descending-score) order, a post is kept unless
 * ANY of its group ids was already claimed by an earlier (higher-ranked) kept
 * post — so the highest-scoring member of a group becomes its representative
 * and the rest drop. Posts absent from the map (ungrouped) are always kept.
 * Input order is preserved.
 */
export function dedupeRankedByGroup(
  posts: FeedPost[],
  groupIdsByPostId: ReadonlyMap<number, number[]>
): FeedPost[] {
  const seenGroups = new Set<number>();
  const result: FeedPost[] = [];
  for (const post of posts) {
    const groupIds = groupIdsByPostId.get(post.id);
    if (!groupIds || groupIds.length === 0) {
      result.push(post);
      continue;
    }
    if (groupIds.some((id) => seenGroups.has(id))) continue;
    for (const id of groupIds) seenGroups.add(id);
    result.push(post);
  }
  return result;
}

// ============================================
// Feed build
// ============================================

async function resolveEmbeddingConfig(): Promise<EmbeddingConfig | null> {
  try {
    return toEmbeddingConfig(await getEmbeddingOpenRouterSettings());
  } catch (error) {
    feedLog.error({ error: error instanceof Error ? error.message : String(error) }, "Feed: embeddings unavailable, falling back to tag similarity only");
    return null;
  }
}

/**
 * Image-embedding nearest neighbors for every seed, keyed by seed post id.
 *
 * The store batches seed ids into 16-seed LATERAL kNN queries: large enough to
 * avoid per-seed round trips, small enough to keep Postgres parallelism across
 * chunks. Returns an empty map when embeddings are unconfigured. Missing source
 * embeddings are absent from the map, and chunk-level failures degrade to empty
 * neighborhoods rather than failing the whole build.
 */
async function fetchEmbeddingNeighborhoods(
  seeds: FeedSeed[],
  embeddingConfig: EmbeddingConfig | null,
  config: FeedConfig
): Promise<Map<number, EmbeddedRelatedPost[]>> {
  if (!embeddingConfig || seeds.length === 0) return new Map();

  return findRelatedPostsByEmbeddingForPosts({
    postIds: seeds.map((seed) => seed.postId),
    config: embeddingConfig,
    limit: config.neighborsPerSeed,
    minScore: config.minEmbeddingScore,
  }).catch((error): Map<number, EmbeddedRelatedPost[]> => {
    feedLog.error({ error: error instanceof Error ? error.message : String(error) }, "Feed: batched embedding neighbors failed");
    return new Map();
  });
}

/**
 * Assemble per-seed candidate neighborhoods from the two engines. Tag-IDF
 * neighborhoods are computed for ALL seeds in one batched query (see
 * {@link getTagNeighborhoodsForSeeds}); embedding neighborhoods are fetched in
 * chunked batches. Missing entries degrade to empty.
 */
function assembleContributions(
  seeds: FeedSeed[],
  embeddingBySeed: Map<number, EmbeddedRelatedPost[]>,
  idfBySeed: Map<number, RecommendedPost[]>,
  polarity: 1 | -1
): SeedContribution[] {
  return seeds.map((seed) => ({
    seed,
    embedding: embeddingBySeed.get(seed.postId) ?? [],
    idf: idfBySeed.get(seed.postId) ?? [],
    polarity,
  }));
}

/**
 * Build the full ranked feed from scratch.
 *
 * Positive seeds (favorites, views) pull in similar posts; negative seeds
 * (recent dismissals) push down posts similar to them. Taste signals are
 * first collapsed to one representative per group (a favorited multi-page
 * set is ONE seed, not one per page). Excludes favorited posts, dismissed
 * posts, and any post sharing a group with a seed of either sign (the
 * per-seed engines already exclude the seed's own group; this applies the
 * rule across seeds too). After merging, candidates receive a small freshness
 * boost, already-viewed candidates are downweighted (decaying with view age),
 * group siblings among candidates collapse to one representative, and only
 * then is the final feed sliced to `maxFeedSize`. Both engines degrade to
 * empty per-seed results on failure rather than failing the build.
 */
export async function buildFeed(config: FeedConfig = FEED_CONFIG): Promise<FeedPost[]> {
  const now = new Date();

  const [favorites, dismissedIds, recentDismissals, views] = await Promise.all([
    prisma.favorite.findMany({
      orderBy: { favoritedAt: "desc" },
      select: {
        postId: true,
        favoritedAt: true,
        post: { select: { hash: true } },
      },
    }),
    // ALL dismissed post ids — needed to exclude every dismissed post from the
    // feed. Id-only, unordered: a cheap primary-key scan even with thousands of
    // dismissals.
    prisma.feedDismissal.findMany({ select: { postId: true } }),
    // Only the most-recent dismissals become negative seeds, so only these need
    // the ordered read + Post join for their hash (embedding lookup). Served by
    // the dismissedAt index; over-fetched so group collapse cannot starve the
    // signal (see SEED_COLLAPSE_OVERFETCH) — selectNegativeSeeds still caps
    // seeds at negativeSeedCount.
    config.negativeSeedCount > 0
      ? prisma.feedDismissal.findMany({
          orderBy: { dismissedAt: "desc" },
          take: config.negativeSeedCount * SEED_COLLAPSE_OVERFETCH,
          select: {
            postId: true,
            dismissedAt: true,
            post: { select: { hash: true } },
          },
        })
      : Promise.resolve([]),
    // Recently-viewed posts that carry no explicit signal yet (not favorited,
    // not dismissed) — the implicit-engagement seeds. Over-fetched like the
    // dismissals above; selectViewSeeds caps seeds at viewSeedCount.
    prisma.postView.findMany({
      where: { post: { favorite: { is: null }, feedDismissal: { is: null } } },
      orderBy: { lastViewedAt: "desc" },
      take: config.viewSeedCount * SEED_COLLAPSE_OVERFETCH,
      select: {
        postId: true,
        viewCount: true,
        lastViewedAt: true,
        post: { select: { hash: true } },
      },
    }),
  ]);

  // Without favorites there is no positive taste to seed from; a feed built
  // only from dislikes/views would have too little explicit signal to rank on.
  if (favorites.length === 0) return [];

  const favoriteInputs: FavoriteSeedInput[] = favorites.map((fav) => ({
    postId: fav.postId,
    hash: fav.post.hash,
    favoritedAt: fav.favoritedAt,
  }));
  const viewInputs: ViewSeedInput[] = views.map((v) => ({
    postId: v.postId,
    hash: v.post.hash,
    viewCount: v.viewCount,
    lastViewedAt: v.lastViewedAt,
  }));
  const dismissalInputs: DismissalSeedInput[] = recentDismissals.map((d) => ({
    postId: d.postId,
    hash: d.post.hash,
    dismissedAt: d.dismissedAt,
  }));

  // Group memberships of every taste signal, for seed-level group collapse:
  // a favorited/viewed/dismissed multi-page set must count as ONE signal, not
  // one per page (see collapseSignalsByGroup).
  const signalIds = [
    ...favoriteInputs.map((f) => f.postId),
    ...viewInputs.map((v) => v.postId),
    ...dismissalInputs.map((d) => d.postId),
  ];
  const signalGroupRows = await prisma.postGroup.findMany({
    where: { postId: { in: signalIds } },
    select: { postId: true, groupId: true },
  });
  const signalGroupsByPostId = new Map<number, number[]>();
  for (const { postId, groupId } of signalGroupRows) {
    const existing = signalGroupsByPostId.get(postId);
    if (existing) existing.push(groupId);
    else signalGroupsByPostId.set(postId, [groupId]);
  }

  // Positive signals share one seen-set — favorites collapse first so a
  // viewed sibling of a favorited set defers to the (stronger) favorite seed.
  // Negative signals collapse independently: a dismissal inside an otherwise-
  // liked set is an explicit correction that must keep its seed.
  const seenPositiveGroups = new Set<number>();
  const collapsedFavorites = collapseSignalsByGroup(
    favoriteInputs,
    signalGroupsByPostId,
    seenPositiveGroups
  );
  const collapsedViews = collapseSignalsByGroup(
    viewInputs,
    signalGroupsByPostId,
    seenPositiveGroups
  );
  const collapsedDismissals = collapseSignalsByGroup(dismissalInputs, signalGroupsByPostId);

  const favoriteSeeds = selectSeeds(
    collapsedFavorites,
    now,
    config,
    mulberry32(currentSeedBucket())
  );

  const viewSeeds = selectViewSeeds(collapsedViews, now, config);

  const negativeSeeds = selectNegativeSeeds(collapsedDismissals, now, config);

  // Favorites and views are positive (boost neighbors); dismissals are negative
  // (suppress neighbors). All three feed the same batched tag compute and
  // chunked embedding fetch, so extra signals add seeds without multiplying
  // query count per seed. Seed sets are disjoint by construction (views exclude
  // favorited/dismissed; favorites and dismissals are mutually exclusive).
  const positiveSeeds = [...favoriteSeeds, ...viewSeeds];
  const allSeeds = [...positiveSeeds, ...negativeSeeds];
  const allSeedIds = allSeeds.map((s) => s.postId);

  const embeddingConfig = await resolveEmbeddingConfig();

  // Tag-IDF neighborhoods for every seed come from ONE batched query; embedding
  // neighborhoods are fetched in bounded chunks so the ANN work can use several
  // backends without one round trip per seed.
  const [seedGroupSiblings, idfBySeed, embeddingBySeed] = await Promise.all([
    prisma.postGroup.findMany({
      where: {
        group: { posts: { some: { postId: { in: allSeedIds } } } },
      },
      select: { postId: true },
    }),
    getTagNeighborhoodsForSeeds(allSeedIds, config.neighborsPerSeed).catch(
      (error): Map<number, RecommendedPost[]> => {
        feedLog.error({ error: error instanceof Error ? error.message : String(error) }, "Feed: batched tag recommendations failed");
        return new Map();
      }
    ),
    fetchEmbeddingNeighborhoods(allSeeds, embeddingConfig, config),
  ]);

  const contributions = [
    ...assembleContributions(positiveSeeds, embeddingBySeed, idfBySeed, 1),
    ...assembleContributions(negativeSeeds, embeddingBySeed, idfBySeed, -1),
  ];

  const excluded = new Set<number>([
    ...favorites.map((fav) => fav.postId),
    ...dismissedIds.map((d) => d.postId),
    ...seedGroupSiblings.map((g) => g.postId),
  ]);

  // Exact embedding availability for the merge's per-pair achievable-weight
  // normalization: which of the seeds AND candidates actually have a stored
  // embedding under the active config (mirrors findRelatedPostsByEmbedding's
  // source filter). One batched indexed read over ~seeds + all distinct
  // candidates; skipped entirely when embeddings are unconfigured (null makes
  // the normalization a uniform, ranking-neutral rescale).
  let embeddedPostIds: ReadonlySet<number> | null = null;
  if (embeddingConfig) {
    const probeIds = new Set<number>(allSeedIds);
    for (const contribution of contributions) {
      for (const neighbor of contribution.embedding) probeIds.add(neighbor.id);
      for (const rec of contribution.idf) probeIds.add(rec.id);
    }
    const embeddedRows =
      probeIds.size > 0
        ? await prisma.postEmbedding.findMany({
            where: {
              postId: { in: [...probeIds] },
              baseUrl: embeddingConfig.baseUrl,
              model: embeddingConfig.model,
              dimensions: embeddingConfig.dimensions,
              imageMaxResolution: embeddingConfig.imageMaxResolution,
              // COMPLETE rows always carry a non-null vector (see the upsert
              // in @/lib/embeddings/store), so status alone is sufficient.
              status: "COMPLETE",
            },
            select: { postId: true },
          })
        : [];
    embeddedPostIds = new Set(embeddedRows.map((row) => row.postId));
  }

  const merged = mergeSeedCandidates(contributions, excluded, config, embeddedPostIds);
  if (merged.length === 0) return merged;

  // Up to three batched lookups over the merged candidates, only when there is
  // a feed: import timestamps (freshness boost), group memberships (per-group
  // dedup below), and view state (the already-seen penalty).
  const mergedIds = merged.map((p) => p.id);
  const [importedRows, groupRows, candidateViews] = await Promise.all([
    config.freshnessBoost > 0
      ? prisma.post.findMany({
          where: { id: { in: mergedIds } },
          select: { id: true, importedAt: true },
        })
      : Promise.resolve([]),
    prisma.postGroup.findMany({
      where: { postId: { in: mergedIds } },
      select: { postId: true, groupId: true },
    }),
    config.viewedCandidatePenaltyFloor < 1
      ? prisma.postView.findMany({
          where: { postId: { in: mergedIds } },
          select: { postId: true, lastViewedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const groupIdsByPostId = new Map<number, number[]>();
  for (const { postId, groupId } of groupRows) {
    const existing = groupIdsByPostId.get(postId);
    if (existing) existing.push(groupId);
    else groupIdsByPostId.set(postId, [groupId]);
  }
  const importedAtByPostId = new Map<number, Date>(
    importedRows.map((p) => [p.id, p.importedAt])
  );
  const lastViewedByPostId = new Map<number, Date>(
    candidateViews.map((v) => [v.postId, v.lastViewedAt])
  );

  // Freshness runs before the viewed penalty: the first-look window applies to
  // new candidates, but a candidate the user already opened can still sink.
  const freshened = applyFreshnessBoost(merged, importedAtByPostId, now, config);

  // Penalize already-viewed candidates BEFORE choosing group representatives,
  // so an unviewed sibling can represent its set over a just-viewed one.
  const penalized = applyViewedPenalty(freshened, lastViewedByPostId, now, config);

  // Collapse multi-post sets (a candidate whose group sibling is also a
  // candidate) to one representative each, so a large set near the user's
  // taste cannot flood the feed. Slice only after collapse so group siblings
  // cannot leave fillable holes.
  return dedupeRankedByGroup(penalized, groupIdsByPostId).slice(0, config.maxFeedSize);
}

/**
 * Full ranked feed cached per seed-sample bucket, shared across Next.js route
 * bundles via globalThis.
 *
 * getFeedPage previously rebuilt the entire ranked feed from scratch on every
 * request — up to ~145 seed neighborhoods (favorites + views + dismissals),
 * one embedding k-NN query each. Pagination clicks and repeat visits all paid
 * that full build. But the ranked feed is DETERMINISTIC within a seed-sample
 * bucket ({@link SEED_SAMPLE_BUCKET_MS}): the sampler reseeds identically, so a
 * rebuild inside the same bucket reproduces the same order for the same data.
 * Caching the built feed keyed by that bucket serves every page within a bucket
 * from a single build.
 *
 * A module-level `let` is per-bundle under Next.js (the /recommended page and
 * the /api/feed route are separate module instances), which is why an earlier
 * cache was abandoned. Stashing it on globalThis gives one instance per
 * process, shared across bundles — the same pattern @/lib/db uses for the
 * Prisma client. Favorite/dismissal writes call {@link invalidateFeedCache} to
 * drop it immediately (explicit taste the user expects reflected at once);
 * views deliberately do not (a weak signal that can wait for the bucket to
 * roll). That means the already-seen penalty ({@link applyViewedPenalty})
 * also lags a fresh view by up to one bucket: a post opened from the feed
 * keeps its pre-view rank until the bucket rolls. Accepted deliberately —
 * invalidating (or re-penalizing at read time) on every view would reshuffle
 * the ranking mid-scroll, breaking the stable pagination this cache exists to
 * provide, and would rebuild the feed on every post open. A monotonic
 * generation counter makes an invalidation that races an in-flight build
 * discard that build's result rather than cache stale data.
 *
 * Invalidation is per-process: the cache and its generation counter live on
 * this process's globalThis, so a single Node instance is load-bearing for the
 * "reflected immediately" guarantee. This app already deploys as one instance
 * (see @/lib/embeddings and sync). Under horizontal scaling, a favorite handled
 * by worker A would not bust worker B's cache — B would serve a feed up to one
 * bucket (SEED_SAMPLE_BUCKET_MS) stale — so cross-worker invalidation would then
 * need a shared signal (pub/sub or a shared store).
 */
interface FeedCacheState {
  entry: { bucket: number; generation: number; feed: FeedPost[] } | null;
  inFlight: Promise<FeedPost[]> | null;
  inFlightBucket: number | null;
  generation: number;
}

const globalForFeed = globalThis as unknown as { __feedCache?: FeedCacheState };

function feedCache(): FeedCacheState {
  if (!globalForFeed.__feedCache) {
    globalForFeed.__feedCache = {
      entry: null,
      inFlight: null,
      inFlightBucket: null,
      generation: 0,
    };
  }
  return globalForFeed.__feedCache;
}

function currentSeedBucket(): number {
  return Math.floor(Date.now() / SEED_SAMPLE_BUCKET_MS);
}

/**
 * Drop the cached feed so the next {@link getFeedPage} rebuilds from fresh
 * data. Called by favorite/dismissal mutations (see @/lib/favorites) — the
 * explicit taste signals a user expects reflected immediately. Bumping the
 * generation also invalidates any build already in flight, so a rebuild that
 * started before the write cannot repopulate the cache with pre-write data.
 */
export function invalidateFeedCache(): void {
  const cache = feedCache();
  cache.generation++;
  cache.entry = null;
  cache.inFlight = null;
  cache.inFlightBucket = null;
}

/**
 * The full ranked feed, cached per seed-sample bucket. Concurrent callers in
 * the same bucket share one in-flight build; on completion the result is cached
 * only if no invalidation raced it (generation unchanged).
 */
async function getCachedFeed(): Promise<FeedPost[]> {
  const cache = feedCache();
  const bucket = currentSeedBucket();

  const entry = cache.entry;
  if (entry && entry.bucket === bucket && entry.generation === cache.generation) {
    return entry.feed;
  }

  if (cache.inFlight && cache.inFlightBucket === bucket) {
    return cache.inFlight;
  }

  const generation = cache.generation;
  const build = buildFeed()
    .then((feed) => {
      // Cache only if nothing invalidated or superseded this build (generation
      // unchanged) AND the bucket has not rolled mid-build — otherwise a build
      // that straddled a bucket boundary could clobber the newer bucket's entry
      // with a stale-labeled one (harmless to reads, but wastes a rebuild).
      if (cache.generation === generation && currentSeedBucket() === bucket) {
        cache.entry = { bucket, generation, feed };
      }
      return feed;
    })
    .finally(() => {
      if (cache.inFlight === build) {
        cache.inFlight = null;
        cache.inFlightBucket = null;
      }
    });

  cache.inFlight = build;
  cache.inFlightBucket = bucket;
  return build;
}

/**
 * Paginated slice of the feed, served from the per-bucket cache
 * ({@link getCachedFeed}). The full ranked feed is built at most once per
 * seed-sample bucket (or until a favorite/dismissal invalidates it), so
 * pagination and repeat visits are array slices, not rebuilds.
 *
 * Precondition: page and limit are pre-sanitized positive integers.
 */
export async function getFeedPage(
  page: number,
  limit: number
): Promise<{ posts: FeedPost[]; totalCount: number; totalPages: number }> {
  const posts = await getCachedFeed();
  const start = (page - 1) * limit;
  return {
    posts: posts.slice(start, start + limit),
    totalCount: posts.length,
    totalPages: Math.ceil(posts.length / limit),
  };
}
