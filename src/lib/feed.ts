/**
 * "For You" feed engine.
 *
 * Explicit favorites and weak view signals are collapsed by post group, then
 * embedded and clustered into stable taste regions. Each cluster centroid
 * retrieves its own ANN neighborhood; candidates must clear the calibrated
 * centroid floor and, for favorite-backed clusters, be close to a real
 * favorite. A dismissal-radius filter removes visual near-neighbors of posts
 * marked not interested. Per-cluster rankings receive freshness and viewed
 * penalties before page quotas proportional to cluster mass are interleaved.
 * Group and perceptual duplicate removal happen before the final feed cap.
 * When embeddings are disabled or no signal is embedded, a small tag-only
 * fallback uses the newest collapsed favorites.
 */

import type { RecommendedPost } from "@/lib/recommendations";
import {
  findNearestByVector,
  getEmbeddingVectorsForPosts,
  getMaxSimilarityToReferences,
} from "@/lib/embeddings/store";
import { prisma } from "@/lib/db";
import { feedLog } from "@/lib/logger";
import { postCardSelect } from "@/lib/post-select";
import { getTagNeighborhoodsForSeeds } from "@/lib/recommendations";
import {
  calibrateEmbeddingScore,
  getEmbeddingBaseline,
} from "@/lib/embeddings/calibration";
import {
  getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured,
  toEmbeddingConfig,
  type EmbeddingConfig,
} from "@/lib/embeddings/settings";
import {
  allocateAcrossClusters,
  fitTasteModel,
  normalizeRows,
  type TasteMember,
} from "@/lib/taste";

export interface FeedConfig {
  /** Number of spherical taste clusters fitted to embedded signals. */
  clusterCount: number;
  /** Clusters smaller than this are merged into their nearest survivor. */
  minClusterSize: number;
  /** Maximum spherical k-means assignment/update passes. */
  clusterIterations: number;
  /** Fixed-LIMIT ANN neighbors fetched per cluster centroid. */
  neighborsPerCluster: number;
  /** Minimum share reserved for each non-empty cluster on every page. */
  floorShare: number;
  /** Slots allocated together before moving to the next page. */
  pageSize: number;
  /** Number of pages assembled into the cached feed. */
  pageCount: number;
  /** Minimum calibrated centroid similarity retained after ANN retrieval. */
  minEmbeddingScore: number;
  /** Minimum calibrated similarity (0 = random-pair baseline, 1 = identical) to a real favorite. */
  memberGate: number;
  /** Calibrated similarity (0 = random-pair baseline, 1 = identical) at which dismissals remove candidates. */
  dismissalRadius: number;
  /** Favorite weight halves every this many days. */
  recencyHalfLifeDays: number;
  /** Maximum number of recent views admitted as weak taste members. */
  viewSeedCount: number;
  /**
   * Maximum newest group-collapsed favorites and views modeled. Successful
   * builds prune the vector cache to these members, bounding it to
   * maxTasteMembers × dimensions × 4 bytes (~25 MB at 2000 × 3072).
   */
  maxTasteMembers: number;
  /** View-member weight halves every this many days. */
  viewRecencyHalfLifeDays: number;
  /** Maximum weight of a fresh, repeatedly viewed member. */
  viewWeightCap: number;
  /** View count at which the logarithmic count factor saturates. */
  viewCountSaturation: number;
  /** Residual multiplier for a candidate viewed just now. */
  viewedCandidatePenaltyFloor: number;
  /** Maximum fractional score lift for a just-imported candidate. */
  freshnessBoost: number;
  /** Freshness boost halves every this many days. */
  freshnessHalfLifeDays: number;
  /** Ranked feed length cap. */
  maxFeedSize: number;
}

export const FEED_CONFIG: FeedConfig = {
  clusterCount: 16,
  minClusterSize: 3,
  clusterIterations: 30,
  neighborsPerCluster: 200,
  floorShare: 0.02,
  pageSize: 48,
  pageCount: 11,
  minEmbeddingScore: 0.25,
  memberGate: 0.25,
  dismissalRadius: 0.6,
  recencyHalfLifeDays: 90,
  viewSeedCount: 25,
  maxTasteMembers: 2000,
  viewRecencyHalfLifeDays: 30,
  viewWeightCap: 0.35,
  viewCountSaturation: 8,
  viewedCandidatePenaltyFloor: 0.3,
  freshnessBoost: 0.15,
  freshnessHalfLifeDays: 7,
  maxFeedSize: 528,
};

export interface FavoriteSeedInput {
  postId: number;
  hash: string;
  favoritedAt: Date;
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
  idf: RecommendedPost[];
}

const DAY_MS = 86_400_000;
const SIGNAL_COLLAPSE_OVERFETCH = 4;
const FALLBACK_FAVORITE_COUNT = 90;
const FALLBACK_NEIGHBOR_COUNT = 20;
const SEED_SAMPLE_BUCKET_MS = 3_600_000;

/** Deterministic 32-bit PRNG retained for taste-model reproducibility helpers. */
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
export function seedWeight(signalAt: Date, now: Date, halfLifeDays: number): number {
  const ageDays = Math.max(0, (now.getTime() - signalAt.getTime()) / DAY_MS);
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}

/**
 * Keep the first signal for each group. Callers pass newest-first lists and
 * may share `seenGroups` so favorites claim groups before weaker views.
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

/** Convert recent views to bounded weak taste members. */
export function selectViewSeeds(
  views: ViewSeedInput[],
  now: Date,
  config: FeedConfig = FEED_CONFIG
): FeedSeed[] {
  if (config.viewSeedCount <= 0 || config.viewWeightCap <= 0) return [];
  const saturationLog = Math.log(1 + Math.max(0, config.viewCountSaturation));
  return views.slice(0, config.viewSeedCount).map((view) => {
    const recency = seedWeight(view.lastViewedAt, now, config.viewRecencyHalfLifeDays);
    const countFactor =
      saturationLog > 0
        ? Math.min(1, Math.log(1 + Math.max(0, view.viewCount)) / saturationLog)
        : 1;
    return {
      postId: view.postId,
      hash: view.hash,
      weight: config.viewWeightCap * recency * countFactor,
    };
  });
}

/**
 * Merge tag candidates for the no-embeddings fallback only. Evidence adds
 * linearly as `seed.weight * cosine`; there is no embedding channel or
 * convergence discount in this deliberately small emergency path.
 */
export function mergeSeedCandidates(
  contributions: readonly SeedContribution[],
  excludedPostIds: ReadonlySet<number>
): FeedPost[] {
  const byId = new Map<number, FeedPost>();
  for (const { seed, idf } of contributions) {
    for (const recommendation of idf) {
      if (excludedPostIds.has(recommendation.id)) continue;
      const contribution = seed.weight * Math.max(0, Math.min(1, recommendation.score));
      if (contribution <= 0) continue;
      const existing = byId.get(recommendation.id);
      if (existing) {
        existing.score += contribution;
      } else {
        byId.set(recommendation.id, {
          id: recommendation.id,
          hash: recommendation.hash,
          width: recommendation.width,
          height: recommendation.height,
          blurhash: recommendation.blurhash,
          mimeType: recommendation.mimeType,
          score: contribution,
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score || a.id - b.id);
}

/** Give newly-imported candidates a small, time-decayed first-look window. */
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

/** Downweight candidates the user has already opened, then restore rank order. */
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

/** Collapse group siblings in ranked order, keeping the highest-ranked member. */
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

/**
 * Perceptual identity: identical blurhash at identical pixel dimensions
 * renders as the same thumbnail even across re-encodes with different hashes
 * and groups. Null when the post has no blurhash.
 */
export function perceptualKey(post: {
  blurhash: string | null;
  width: number | null;
  height: number | null;
}): string | null {
  return post.blurhash
    ? `${post.blurhash}|${post.width ?? ""}x${post.height ?? ""}`
    : null;
}

export function perceptualKeyByPostId(
  posts: readonly { id: number; blurhash: string | null; width: number | null; height: number | null }[]
): Map<number, string> {
  const keys = new Map<number, string>();
  for (const post of posts) {
    const key = perceptualKey(post);
    if (key) keys.set(post.id, key);
  }
  return keys;
}

/** Collapse perceptual near-duplicates in ranked order. */
export function dedupeRankedByBlurhash(posts: FeedPost[]): FeedPost[] {
  const seenKeys = new Set<string>();
  const result: FeedPost[] = [];
  for (const post of posts) {
    const key = perceptualKey(post);
    if (key) {
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
    }
    result.push(post);
  }
  return result;
}

interface FeedBuildResult {
  feed: FeedPost[];
  degraded: boolean;
}

interface FeedVectorCache {
  key: string;
  vectors: Map<number, Float32Array>;
}

interface FeedCentroidCache {
  key: string;
  centroids: Float32Array;
}

const globalForTaste = globalThis as unknown as {
  __feedVectors?: FeedVectorCache;
  __feedCentroids?: FeedCentroidCache;
};

function embeddingConfigKey(config: EmbeddingConfig): string {
  return [
    config.baseUrl,
    config.model,
    config.dimensions,
    config.imageMaxResolution,
  ].join("|");
}

async function resolveEmbeddingConfig(): Promise<{
  config: EmbeddingConfig | null;
  failed: boolean;
}> {
  try {
    const settings = await getEmbeddingOpenRouterSettings();
    return {
      config: isEmbeddingProviderConfigured(settings)
        ? toEmbeddingConfig(settings)
        : null,
      failed: false,
    };
  } catch (error) {
    feedLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Feed: embedding settings unavailable"
    );
    return { config: null, failed: true };
  }
}

async function rankFallback(
  favorites: readonly FavoriteSeedInput[],
  excluded: ReadonlySet<number>,
  now: Date,
  config: FeedConfig,
  degraded: boolean
): Promise<FeedBuildResult> {
  const seeds = favorites.slice(0, FALLBACK_FAVORITE_COUNT).map((favorite) => ({
    postId: favorite.postId,
    hash: favorite.hash,
    weight: seedWeight(favorite.favoritedAt, now, config.recencyHalfLifeDays),
  }));
  if (seeds.length === 0) return { feed: [], degraded };

  let neighborhoods: Map<number, RecommendedPost[]>;
  try {
    neighborhoods = await getTagNeighborhoodsForSeeds(
      seeds.map((seed) => seed.postId),
      FALLBACK_NEIGHBOR_COUNT
    );
  } catch (error) {
    feedLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Feed: tag fallback recommendations failed"
    );
    return { feed: [], degraded: true };
  }

  const merged = mergeSeedCandidates(
    seeds.map((seed) => ({ seed, idf: neighborhoods.get(seed.postId) ?? [] })),
    excluded
  );
  if (merged.length === 0) return { feed: [], degraded };

  const ids = merged.map((post) => post.id);
  const [importedRows, groupRows, candidateViews] = await Promise.all([
    config.freshnessBoost > 0
      ? prisma.post.findMany({
          where: { id: { in: ids } },
          select: { id: true, importedAt: true },
        })
      : Promise.resolve([]),
    prisma.postGroup.findMany({
      where: { postId: { in: ids } },
      select: { postId: true, groupId: true },
    }),
    config.viewedCandidatePenaltyFloor < 1
      ? prisma.postView.findMany({
          where: { postId: { in: ids } },
          select: { postId: true, lastViewedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const importedAtByPostId = new Map<number, Date>(
    importedRows.map((post) => [post.id, post.importedAt])
  );
  const groupIdsByPostId = new Map<number, number[]>();
  for (const { postId, groupId } of groupRows) {
    const existing = groupIdsByPostId.get(postId);
    if (existing) existing.push(groupId);
    else groupIdsByPostId.set(postId, [groupId]);
  }
  const lastViewedByPostId = new Map<number, Date>(
    candidateViews.map((view) => [view.postId, view.lastViewedAt])
  );
  const freshened = applyFreshnessBoost(merged, importedAtByPostId, now, config);
  const penalized = applyViewedPenalty(freshened, lastViewedByPostId, now, config);
  return {
    feed: dedupeRankedByBlurhash(
      dedupeRankedByGroup(penalized, groupIdsByPostId)
    ).slice(0, config.maxFeedSize),
    degraded,
  };
}

/**
 * Build a taste-cluster feed. Store/taste failures return a degraded result;
 * only successfully-read disabled embeddings or zero embedded members use the
 * tag fallback, so transient settings or cluster failures never replace a
 * healthy cached feed with a tag-only ranking.
 */
async function buildFeedDetailed(
  config: FeedConfig = FEED_CONFIG
): Promise<FeedBuildResult> {
  try {
    return await buildFeedUnsafe(config);
  } catch (error) {
    feedLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Feed: build failed"
    );
    return { feed: [], degraded: true };
  }
}

async function buildFeedUnsafe(
  config: FeedConfig = FEED_CONFIG
): Promise<FeedBuildResult> {
  const now = new Date();
  const [favorites, dismissedRows, views] = await Promise.all([
    prisma.favorite.findMany({
      orderBy: { favoritedAt: "desc" },
      select: {
        postId: true,
        favoritedAt: true,
        post: { select: { hash: true } },
      },
    }),
    prisma.feedDismissal.findMany({ select: { postId: true } }),
    prisma.postView.findMany({
      where: { post: { favorite: { is: null }, feedDismissal: { is: null } } },
      orderBy: { lastViewedAt: "desc" },
      take: config.viewSeedCount * SIGNAL_COLLAPSE_OVERFETCH,
      select: {
        postId: true,
        viewCount: true,
        lastViewedAt: true,
        post: { select: { hash: true } },
      },
    }),
  ]);
  if (favorites.length === 0) return { feed: [], degraded: false };

  const favoriteInputs: FavoriteSeedInput[] = favorites.map((favorite) => ({
    postId: favorite.postId,
    hash: favorite.post.hash,
    favoritedAt: favorite.favoritedAt,
  }));
  const viewInputs: ViewSeedInput[] = views.map((view) => ({
    postId: view.postId,
    hash: view.post.hash,
    viewCount: view.viewCount,
    lastViewedAt: view.lastViewedAt,
  }));
  const dismissedIds = dismissedRows.map((dismissal) => dismissal.postId);
  const signalIds = [
    ...favoriteInputs.map((favorite) => favorite.postId),
    ...viewInputs.map((view) => view.postId),
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
  const modelFavorites = collapsedFavorites.slice(0, config.maxTasteMembers);
  const favoriteMembers: TasteMember[] = modelFavorites.map((favorite) => ({
    postId: favorite.postId,
    weight: seedWeight(favorite.favoritedAt, now, config.recencyHalfLifeDays),
    kind: "favorite",
  }));
  const remainingMemberCapacity = Math.max(
    0,
    config.maxTasteMembers - favoriteMembers.length
  );
  const viewMembers: TasteMember[] = selectViewSeeds(
    collapsedViews,
    now,
    config
  )
    .slice(0, remainingMemberCapacity)
    .map((view) => ({
      postId: view.postId,
      weight: view.weight,
      kind: "view",
    }));
  const members = [...favoriteMembers, ...viewMembers];

  const excludedGroupSiblingsPromise = prisma.postGroup.findMany({
    where: {
      group: {
        posts: {
          some: {
            OR: [
              { postId: { in: dismissedIds } },
              { post: { favorite: { isNot: null } } },
            ],
          },
        },
      },
    },
    select: { postId: true },
  });
  const [{ config: embeddingConfig, failed: embeddingConfigFailed }, excludedGroupSiblings] =
    await Promise.all([resolveEmbeddingConfig(), excludedGroupSiblingsPromise]);
  const excluded = new Set<number>([
    ...favorites.map((favorite) => favorite.postId),
    ...dismissedIds,
    ...excludedGroupSiblings.map((row) => row.postId),
  ]);

  if (embeddingConfigFailed) {
    return { feed: [], degraded: true };
  }

  if (!embeddingConfig) {
    return rankFallback(collapsedFavorites, excluded, now, config, false);
  }

    const cacheKey = embeddingConfigKey(embeddingConfig);
    let vectorCache = globalForTaste.__feedVectors;
    if (!vectorCache || vectorCache.key !== cacheKey) {
      vectorCache = { key: cacheKey, vectors: new Map() };
      globalForTaste.__feedVectors = vectorCache;
      globalForTaste.__feedCentroids = undefined;
    }
    const missingIds = members
      .map((member) => member.postId)
      .filter((postId) => !vectorCache.vectors.has(postId));
    if (missingIds.length > 0) {
      const rows = await getEmbeddingVectorsForPosts({
        postIds: missingIds,
        config: embeddingConfig,
      });
      for (const row of rows) vectorCache.vectors.set(row.postId, row.vector);
    }

    const embeddedMembers = members.filter((member) =>
      vectorCache.vectors.has(member.postId)
    );
    if (embeddedMembers.length === 0) {
      return rankFallback(collapsedFavorites, excluded, now, config, false);
    }
    const vectors = new Float32Array(
      embeddedMembers.length * embeddingConfig.dimensions
    );
    for (let row = 0; row < embeddedMembers.length; row++) {
      const vector = vectorCache.vectors.get(embeddedMembers[row].postId);
      if (!vector) continue;
      vectors.set(vector, row * embeddingConfig.dimensions);
    }
    normalizeRows(vectors, embeddingConfig.dimensions);
    const centroidCache = globalForTaste.__feedCentroids;
    const warmStart =
      centroidCache?.key === cacheKey ? centroidCache.centroids : null;
    const model = fitTasteModel(
      embeddedMembers,
      vectors,
      embeddingConfig.dimensions,
      {
        clusterCount: config.clusterCount,
        minClusterSize: config.minClusterSize,
        maxIterations: config.clusterIterations,
      },
      currentSeedBucket(),
      warmStart
    );
    const currentMemberIds = new Set(members.map((member) => member.postId));
    for (const postId of vectorCache.vectors.keys()) {
      if (!currentMemberIds.has(postId)) vectorCache.vectors.delete(postId);
    }
    const centroids = new Float32Array(
      model.clusters.length * embeddingConfig.dimensions
    );
    for (let index = 0; index < model.clusters.length; index++) {
      centroids.set(
        model.clusters[index].centroid,
        index * embeddingConfig.dimensions
      );
    }
    globalForTaste.__feedCentroids = {
      key: cacheKey,
      centroids,
    };
    if (model.clusters.length === 0) {
      return { feed: [], degraded: true };
    }

    const baselinePromise = getEmbeddingBaseline(embeddingConfig);
    const annPromise = Promise.all(
      model.clusters.map((cluster) =>
        findNearestByVector({
          vector: cluster.centroid,
          config: embeddingConfig,
          limit: config.neighborsPerCluster,
        })
      )
    );
    const [baseline, neighborhoods] = await Promise.all([
      baselinePromise,
      annPromise,
    ]);
    const candidatesByCluster = new Map<
      number,
      { id: number; score: number }[]
    >();
    for (let index = 0; index < model.clusters.length; index++) {
      const cluster = model.clusters[index];
      const candidates = neighborhoods[index]
        .map((neighbor) => ({
          id: neighbor.postId,
          score: calibrateEmbeddingScore(neighbor.score, baseline),
        }))
        .filter(
          (candidate) =>
            candidate.score >= config.minEmbeddingScore &&
            !excluded.has(candidate.id)
        );
      candidatesByCluster.set(cluster.index, candidates);
    }

    await Promise.all(
      model.clusters.map(async (cluster) => {
        const candidates = candidatesByCluster.get(cluster.index) ?? [];
        if (cluster.favoritePostIds.length === 0 || candidates.length === 0) return;
        const similarities = await getMaxSimilarityToReferences({
          candidateIds: candidates.map((candidate) => candidate.id),
          referenceIds: cluster.favoritePostIds,
          config: embeddingConfig,
        });
        candidatesByCluster.set(
          cluster.index,
          candidates.filter((candidate) => {
            const raw = similarities.get(candidate.id);
            return (
              raw !== undefined &&
              calibrateEmbeddingScore(raw, baseline) >= config.memberGate
            );
          })
        );
      })
    );

    if (dismissedIds.length > 0) {
      const allCandidateIds = [
        ...new Set(
          [...candidatesByCluster.values()].flatMap((candidates) =>
            candidates.map((candidate) => candidate.id)
          )
        ),
      ];
      if (allCandidateIds.length > 0) {
        const similarities = await getMaxSimilarityToReferences({
          candidateIds: allCandidateIds,
          referenceIds: dismissedIds,
          config: embeddingConfig,
        });
        for (const [cluster, candidates] of candidatesByCluster) {
          candidatesByCluster.set(
            cluster,
            candidates.filter((candidate) => {
              const raw = similarities.get(candidate.id);
              return (
                raw === undefined ||
                calibrateEmbeddingScore(raw, baseline) < config.dismissalRadius
              );
            })
          );
        }
      }
    }

    const survivingIds = [
      ...new Set(
        [...candidatesByCluster.values()].flatMap((candidates) =>
          candidates.map((candidate) => candidate.id)
        )
      ),
    ];
    if (survivingIds.length === 0) return { feed: [], degraded: false };
    const [postRows, groupRows, candidateViews] = await Promise.all([
      prisma.post.findMany({
        where: { id: { in: survivingIds } },
        select: { ...postCardSelect, importedAt: true },
      }),
      prisma.postGroup.findMany({
        where: { postId: { in: survivingIds } },
        select: { postId: true, groupId: true },
      }),
      config.viewedCandidatePenaltyFloor < 1
        ? prisma.postView.findMany({
            where: { postId: { in: survivingIds } },
            select: { postId: true, lastViewedAt: true },
          })
        : Promise.resolve([]),
    ]);
    const postsById = new Map(postRows.map((post) => [post.id, post]));
    const importedAtByPostId = new Map(
      postRows.map((post) => [post.id, post.importedAt])
    );
    const groupIdsByPostId = new Map<number, number[]>();
    for (const { postId, groupId } of groupRows) {
      const existing = groupIdsByPostId.get(postId);
      if (existing) existing.push(groupId);
      else groupIdsByPostId.set(postId, [groupId]);
    }
    const lastViewedByPostId = new Map<number, Date>(
      candidateViews.map((view) => [view.postId, view.lastViewedAt])
    );
    const rankedByCluster = new Map<number, FeedPost[]>();
    const massByCluster = new Map<number, number>();
    for (const cluster of model.clusters) {
      const ranked: FeedPost[] = [];
      for (const candidate of candidatesByCluster.get(cluster.index) ?? []) {
        const post = postsById.get(candidate.id);
        if (!post) continue;
        ranked.push({
          id: post.id,
          hash: post.hash,
          width: post.width,
          height: post.height,
          blurhash: post.blurhash,
          mimeType: post.mimeType,
          score: candidate.score,
        });
      }
      const freshened = applyFreshnessBoost(
        ranked,
        importedAtByPostId,
        now,
        config
      );
      rankedByCluster.set(
        cluster.index,
        applyViewedPenalty(freshened, lastViewedByPostId, now, config)
      );
      massByCluster.set(cluster.index, cluster.mass);
    }
    const allocated = allocateAcrossClusters(
      rankedByCluster,
      massByCluster,
      groupIdsByPostId,
      {
        pageSize: config.pageSize,
        pageCount: config.pageCount,
        floorShare: config.floorShare,
      },
      perceptualKeyByPostId(postRows)
    );
    return {
      feed: allocated.map(({ item }) => item).slice(0, config.maxFeedSize),
      degraded: false,
    };
}

export async function buildFeed(config: FeedConfig = FEED_CONFIG): Promise<FeedPost[]> {
  return (await buildFeedDetailed(config)).feed;
}

/**
 * Full ranked feed cached per seed-sample bucket, shared across Next.js route
 * bundles via globalThis.
 *
 * getFeedPage previously rebuilt the ranked feed on every request, repeating
 * the same centroid ANN and gate queries for pagination clicks. The model seed
 * and ranked feed are deterministic within {@link SEED_SAMPLE_BUCKET_MS}, so
 * one cached build serves every page in that bucket.
 *
 * A module-level `let` is per-bundle under Next.js (the /recommended page and
 * the /api/feed route are separate module instances), which is why an earlier
 * cache was abandoned. Stashing it on globalThis gives one instance per
 * process, shared across bundles — the same pattern @/lib/db uses for the
 * Prisma client.
 *
 * Reads are STALE-WHILE-REVALIDATE. Favorite/dismissal writes call
 * {@link invalidateFeedCache}, which marks the cached feed stale (generation
 * bump) but keeps it servable: reads return the previous ranking instantly
 * and the first such read kicks off ONE background rebuild that swaps the
 * entry in when it completes. EVERY read during the rebuild window serves
 * the stale ranking — a just-favorited or just-dismissed post keeps
 * appearing until the rebuild lands — and a failed rebuild extends that
 * window until a later read's retry succeeds (failures are logged). A read
 * only waits on a build when NO entry is retained: true cold start, or the
 * first read after {@link clearFeedCache}'s destructive drop. Views
 * deliberately do not invalidate (a weak signal that can wait for the bucket
 * to roll), so the already-seen penalty ({@link applyViewedPenalty}) lags a
 * fresh view by up to one bucket — accepted, since re-penalizing at read
 * time would reshuffle the ranking mid-scroll and break the stable
 * pagination this cache exists to provide. A monotonic generation counter
 * makes an invalidation that races an in-flight build discard that build's
 * result rather than cache pre-write data.
 *
 * Invalidation is per-process: the cache and its generation counter live on
 * this process's globalThis, so a single Node instance is load-bearing for
 * revalidation kicking in on the next read. This app already deploys as one
 * instance (see @/lib/embeddings and sync). Under horizontal scaling, a
 * favorite handled by worker A would not bust worker B's cache — B would
 * serve a feed up to one bucket (SEED_SAMPLE_BUCKET_MS) stale — so
 * cross-worker invalidation would then need a shared signal (pub/sub or a
 * shared store).
 */
interface FeedCacheState {
  entry: { bucket: number; generation: number; feed: FeedPost[] } | null;
  inFlight: Promise<FeedPost[]> | null;
  inFlightBucket: number | null;
  generation: number;
  /**
   * Every build not yet settled, INCLUDING builds detached from `inFlight`
   * by an invalidation. {@link settleFeedRebuild} awaits this whole set so
   * no rebuild can outlive a caller that needs quiescence (test cleanup).
   */
  liveBuilds: Set<Promise<FeedPost[]>>;
}

const globalForFeed = globalThis as unknown as { __feedCache?: FeedCacheState };

function feedCache(): FeedCacheState {
  if (!globalForFeed.__feedCache) {
    globalForFeed.__feedCache = {
      entry: null,
      inFlight: null,
      inFlightBucket: null,
      generation: 0,
      liveBuilds: new Set(),
    };
  }
  return globalForFeed.__feedCache;
}

function currentSeedBucket(): number {
  return Math.floor(Date.now() / SEED_SAMPLE_BUCKET_MS);
}

/**
 * Mark the cached feed stale so the next {@link getFeedPage} revalidates.
 * Called by favorite/dismissal mutations (see @/lib/favorites). The entry is
 * KEPT — stale-while-revalidate serves it while the background rebuild runs.
 * Bumping the generation both marks the entry stale and makes any build
 * already in flight discard its result instead of caching pre-write data;
 * detaching that in-flight build lets the next read start a fresh one.
 */
export function invalidateFeedCache(): void {
  const cache = feedCache();
  cache.generation++;
  cache.inFlight = null;
  cache.inFlightBucket = null;
}

/**
 * Hard-drop the cached feed, INCLUDING the stale entry that
 * {@link invalidateFeedCache} would keep serving.
 *
 * For destructive resets only — a sync that deletes/reshapes posts makes the
 * cached ranking reference rows that no longer exist, so serving it stale is
 * wrong, not merely outdated. Taste mutations (favorites/dismissals) use
 * {@link invalidateFeedCache} instead so reads stay non-blocking.
 */
export function clearFeedCache(): void {
  invalidateFeedCache();
  feedCache().entry = null;
  clearTasteCaches();
}

/**
 * Drop the cached member vectors and centroids. Required whenever stored
 * embeddings under the active config are deleted or replaced; the vector
 * cache otherwise treats a post as embedded for as long as its id is present.
 */
export function clearTasteCaches(): void {
  globalForTaste.__feedVectors = undefined;
  globalForTaste.__feedCentroids = undefined;
}

/**
 * The full ranked feed, stale-while-revalidate per seed-sample bucket.
 *
 * Fresh entry (same bucket, same generation): served directly. Otherwise a
 * rebuild is started — or joined, so concurrent callers in the same bucket
 * share one build — and any previous entry (stale generation OR rolled
 * bucket) is returned immediately while the rebuild completes in the
 * background. A read awaits the build only when no entry is retained (cold
 * start, or first read after {@link clearFeedCache}).
 * On completion the result is cached only if neither engine degraded and no
 * invalidation or bucket roll raced it; degraded cold-start results return to
 * the caller but are retried on the next read.
 */
async function getCachedFeed(): Promise<FeedPost[]> {
  const cache = feedCache();
  const bucket = currentSeedBucket();

  const entry = cache.entry;
  if (entry && entry.bucket === bucket && entry.generation === cache.generation) {
    return entry.feed;
  }

  let build = cache.inFlight && cache.inFlightBucket === bucket ? cache.inFlight : null;
  if (!build) {
    const generation = cache.generation;
    const started = buildFeedDetailed()
      .then(({ feed, degraded }) => {
        // Cache only if both engines were healthy, nothing invalidated or
        // superseded this build, and its sample bucket did not roll.
        if (
          !degraded &&
          cache.generation === generation &&
          currentSeedBucket() === bucket
        ) {
          cache.entry = { bucket, generation, feed };
        } else if (degraded) {
          feedLog.warn(
            "Feed: degraded rebuild was not cached; retaining stale feed when available"
          );
        }
        return feed;
      })
      .finally(() => {
        cache.liveBuilds.delete(started);
        if (cache.inFlight === started) {
          cache.inFlight = null;
          cache.inFlightBucket = null;
        }
      });
    cache.liveBuilds.add(started);
    cache.inFlight = started;
    cache.inFlightBucket = bucket;
    build = started;
  }

  // Stale-while-revalidate: any previous ranking serves instantly while the
  // rebuild runs. The rebuild's rejection is consumed here — the stale entry
  // keeps serving and the next read retries.
  if (entry) {
    build.catch((error: unknown) => {
      feedLog.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Feed: background revalidation failed; continuing to serve stale feed"
      );
    });
    return entry.feed;
  }

  return build;
}

/**
 * Wait until every feed rebuild — in-flight or detached by an invalidation —
 * has settled (resolved or rejected).
 *
 * Test hook: stale-while-revalidate makes reads non-blocking, so tests that
 * assert post-rebuild content call this between the read that triggered
 * revalidation and the read that asserts the fresh ranking. Also prevents a
 * background build from one test outliving it and racing the next test's
 * database cleanup.
 */
export async function settleFeedRebuild(): Promise<void> {
  const cache = feedCache();
  // A settling build can trigger no successors on its own, but loop until
  // quiescent in case reads raced in while awaiting.
  while (cache.liveBuilds.size > 0) {
    await Promise.allSettled([...cache.liveBuilds]);
  }
}

/**
 * Whether any feed rebuild is currently live (in-flight or detached).
 *
 * Test hook: lets a test assert the non-blocking stale-while-revalidate
 * contract — a read that served the stale entry must resolve WHILE the
 * rebuild it triggered is still live, not after it.
 */
export function feedRebuildInFlight(): boolean {
  return feedCache().liveBuilds.size > 0;
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
