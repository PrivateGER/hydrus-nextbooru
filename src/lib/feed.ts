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
 * are unit-tested; DB/build/cache plumbing follows.
 */

import type { RecommendedPost } from "@/lib/recommendations";
import type { EmbeddedRelatedPost } from "@/lib/embeddings/store";

export interface FeedConfig {
  /** Most recent favorites always used as seeds (current taste). */
  recentSeedCount: number;
  /** Older favorites sampled with recency-decayed probability (long-term taste). */
  sampledSeedCount: number;
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
  /** Ranked feed length cap. */
  maxFeedSize: number;
  /** In-process feed cache TTL. */
  cacheTtlMs: number;
}

export const FEED_CONFIG: FeedConfig = {
  recentSeedCount: 30,
  sampledSeedCount: 20,
  neighborsPerSeed: 20,
  embeddingWeight: 0.7,
  idfWeight: 0.3,
  recencyHalfLifeDays: 90,
  minEmbeddingScore: 0.25,
  maxFeedSize: 500,
  cacheTtlMs: 60 * 60 * 1000,
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

/** Exponential recency decay: 1 at age 0, 0.5 after one half-life. */
export function seedWeight(favoritedAt: Date, now: Date, halfLifeDays: number): number {
  const ageDays = Math.max(0, (now.getTime() - favoritedAt.getTime()) / DAY_MS);
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}

/**
 * Stratified seed selection.
 *
 * The `recentSeedCount` newest favorites are always seeds. From the older
 * remainder, `sampledSeedCount` favorites are drawn without replacement with
 * probability proportional to their recency weight, so long-standing tastes
 * stay represented without letting ancient favorites dominate.
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

  const sampled: FavoriteSeedInput[] = [];
  if (older.length > 0 && config.sampledSeedCount > 0) {
    const pool = older.map((fav) => ({
      fav,
      weight: seedWeight(fav.favoritedAt, now, config.recencyHalfLifeDays),
    }));
    const target = Math.min(config.sampledSeedCount, pool.length);

    while (sampled.length < target) {
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
      sampled.push(pool[picked].fav);
      pool.splice(picked, 1);
    }
  }

  return [...recent, ...sampled].map((fav) => ({
    postId: fav.postId,
    hash: fav.hash,
    weight: seedWeight(fav.favoritedAt, now, config.recencyHalfLifeDays),
  }));
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
