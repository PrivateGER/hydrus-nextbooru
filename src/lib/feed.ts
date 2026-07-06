/**
 * "For You" feed engine.
 *
 * Multi-seed k-NN aggregation: each favorited post seeds two candidate
 * neighborhoods — image-embedding nearest neighbors (pgvector) and
 * IDF-weighted tag similarity (the existing PostRecommendation engine).
 * Candidates are merged with recency-decayed seed weights; convergent
 * evidence (a candidate reached from several seeds) accumulates score.
 *
 * The pure functions (seed selection, score merging) live at the top and
 * are unit-tested; DB/build plumbing follows.
 */

import type { RecommendedPost } from "@/lib/recommendations";
import type { EmbeddedRelatedPost } from "@/lib/embeddings/store";
import { prisma } from "@/lib/db";
import { getTagNeighborhoodsForSeeds } from "@/lib/recommendations";
import {
  getEmbeddingOpenRouterSettings,
  toEmbeddingConfig,
  type EmbeddingConfig,
} from "@/lib/embeddings/settings";
import { findRelatedPostsByEmbedding } from "@/lib/embeddings/store";

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
  maxFeedSize: 500,
};

export interface FavoriteSeedInput {
  postId: number;
  hash: string;
  favoritedAt: Date;
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
}

const DAY_MS = 86_400_000;

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
 * Merge per-seed candidate neighborhoods into one ranked list.
 *
 * Embedding scores are cosine similarities already in [0,1] (clamped
 * defensively). IDF scores are unbounded, so they are normalized per seed by
 * that seed's maximum (best tag-similar candidate -> 1). Each candidate's
 * contribution is seedWeight * (engineWeight * normalizedScore); candidates
 * reached from several seeds accumulate.
 */
export function mergeSeedCandidates(
  contributions: SeedContribution[],
  excludedPostIds: ReadonlySet<number>,
  config: FeedConfig = FEED_CONFIG
): FeedPost[] {
  const byId = new Map<number, FeedPost>();

  const add = (
    post: { id: number; hash: string; width: number | null; height: number | null; blurhash: string | null; mimeType: string },
    contribution: number
  ) => {
    if (contribution <= 0 || excludedPostIds.has(post.id)) return;
    const existing = byId.get(post.id);
    if (existing) {
      existing.score += contribution;
    } else {
      byId.set(post.id, {
        id: post.id,
        hash: post.hash,
        width: post.width,
        height: post.height,
        blurhash: post.blurhash,
        mimeType: post.mimeType,
        score: contribution,
      });
    }
  };

  for (const { seed, embedding, idf } of contributions) {
    for (const neighbor of embedding) {
      const similarity = Math.max(0, Math.min(1, neighbor.score));
      add(neighbor, seed.weight * config.embeddingWeight * similarity);
    }

    const maxIdf = idf.reduce((max, rec) => Math.max(max, rec.score), 0);
    if (maxIdf > 0) {
      for (const rec of idf) {
        add(rec, seed.weight * config.idfWeight * (rec.score / maxIdf));
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, config.maxFeedSize);
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
    console.error("Feed: embeddings unavailable, falling back to tag similarity only:", error);
    return null;
  }
}

/**
 * Image-embedding nearest neighbors for every seed, keyed by seed post id.
 *
 * These use the pgvector `vchordrq` ANN index and are cheap individually; the
 * flat Promise.all is bounded by Prisma's connection pool (single-user
 * deployment). Returns an empty map when embeddings are unconfigured. Each
 * seed degrades to an empty neighborhood on failure rather than failing the
 * whole build.
 */
async function fetchEmbeddingNeighborhoods(
  seeds: FeedSeed[],
  embeddingConfig: EmbeddingConfig | null,
  config: FeedConfig
): Promise<Map<number, EmbeddedRelatedPost[]>> {
  const bySeed = new Map<number, EmbeddedRelatedPost[]>();
  if (!embeddingConfig || seeds.length === 0) return bySeed;

  const results = await Promise.all(
    seeds.map((seed) =>
      findRelatedPostsByEmbedding({
        hash: seed.hash,
        config: embeddingConfig,
        limit: config.neighborsPerSeed,
        minScore: config.minEmbeddingScore,
      })
        .catch((error): EmbeddedRelatedPost[] => {
          console.error(`Feed: embedding neighbors failed for seed ${seed.hash}:`, error);
          return [];
        })
        .then((neighbors) => [seed.postId, neighbors] as const)
    )
  );

  for (const [postId, neighbors] of results) bySeed.set(postId, neighbors);
  return bySeed;
}

/**
 * Assemble per-seed candidate neighborhoods from the two engines. Tag-IDF
 * neighborhoods are computed for ALL seeds in one batched query (see
 * {@link getTagNeighborhoodsForSeeds}); embedding neighborhoods are fetched
 * per seed. Missing entries degrade to empty.
 */
function assembleContributions(
  seeds: FeedSeed[],
  embeddingBySeed: Map<number, EmbeddedRelatedPost[]>,
  idfBySeed: Map<number, RecommendedPost[]>
): SeedContribution[] {
  return seeds.map((seed) => ({
    seed,
    embedding: embeddingBySeed.get(seed.postId) ?? [],
    idf: idfBySeed.get(seed.postId) ?? [],
  }));
}

/**
 * Build the full ranked feed from scratch.
 *
 * Excludes favorited posts, dismissed posts, and any post sharing a group
 * with a seed (the per-seed engines already exclude the seed's own group;
 * this applies the rule across seeds too). Both engines degrade to empty
 * per-seed results on failure rather than failing the build.
 */
export async function buildFeed(config: FeedConfig = FEED_CONFIG): Promise<FeedPost[]> {
  const favorites = await prisma.favorite.findMany({
    orderBy: { favoritedAt: "desc" },
    select: {
      postId: true,
      favoritedAt: true,
      post: { select: { hash: true } },
    },
  });

  if (favorites.length === 0) return [];

  const seeds = selectSeeds(
    favorites.map((fav) => ({
      postId: fav.postId,
      hash: fav.post.hash,
      favoritedAt: fav.favoritedAt,
    })),
    new Date(),
    config,
    mulberry32(Math.floor(Date.now() / SEED_SAMPLE_BUCKET_MS))
  );

  const embeddingConfig = await resolveEmbeddingConfig();
  const seedIds = seeds.map((s) => s.postId);

  // Tag-IDF neighborhoods for every seed come from ONE batched query; embedding
  // neighborhoods are fetched per seed (cheap via the ANN index). Prisma queues
  // work beyond its pool size, so the flat fan-out is safe (single-user).
  const [dismissals, seedGroupSiblings, idfBySeed, embeddingBySeed] = await Promise.all([
    prisma.feedDismissal.findMany({ select: { postId: true } }),
    prisma.postGroup.findMany({
      where: {
        group: { posts: { some: { postId: { in: seedIds } } } },
      },
      select: { postId: true },
    }),
    getTagNeighborhoodsForSeeds(seedIds, config.neighborsPerSeed).catch(
      (error): Map<number, RecommendedPost[]> => {
        console.error("Feed: batched tag recommendations failed:", error);
        return new Map();
      }
    ),
    fetchEmbeddingNeighborhoods(seeds, embeddingConfig, config),
  ]);

  const contributions = assembleContributions(seeds, embeddingBySeed, idfBySeed);

  const excluded = new Set<number>([
    ...favorites.map((fav) => fav.postId),
    ...dismissals.map((d) => d.postId),
    ...seedGroupSiblings.map((g) => g.postId),
  ]);

  const merged = mergeSeedCandidates(contributions, excluded, config);
  if (merged.length === 0) return merged;

  // Collapse multi-post sets (a candidate whose group sibling is also a
  // candidate) to one representative each, so a large set near the user's
  // taste cannot flood the feed. One extra query, only when there is a feed.
  const groupRows = await prisma.postGroup.findMany({
    where: { postId: { in: merged.map((p) => p.id) } },
    select: { postId: true, groupId: true },
  });
  const groupIdsByPostId = new Map<number, number[]>();
  for (const { postId, groupId } of groupRows) {
    const existing = groupIdsByPostId.get(postId);
    if (existing) existing.push(groupId);
    else groupIdsByPostId.set(postId, [groupId]);
  }

  return dedupeRankedByGroup(merged, groupIdsByPostId);
}

/**
 * Paginated slice of the feed. Rebuilds the full ranked feed on every call —
 * there is intentionally no in-process cache. A module-level cache is
 * per-bundle under Next.js (the /recommended page and the API-route bundles
 * get separate module instances) and per-process, so a favorite/dismissal
 * mutation cannot invalidate it reliably: one bundle would serve stale data.
 * A fresh build is cheap for this single-user app — the IDF layer is DB-cached
 * for 24h by getTagNeighborhoodsForSeeds (one batched compute for all cold
 * seeds) and embedding k-NN is ms-scale via the ANN index.
 *
 * Precondition: page and limit are pre-sanitized positive integers.
 */
export async function getFeedPage(
  page: number,
  limit: number
): Promise<{ posts: FeedPost[]; totalCount: number; totalPages: number }> {
  const posts = await buildFeed();
  const start = (page - 1) * limit;
  return {
    posts: posts.slice(start, start + limit),
    totalCount: posts.length,
    totalPages: Math.ceil(posts.length / limit),
  };
}
