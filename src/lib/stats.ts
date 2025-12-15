import { prisma } from "@/lib/db";
import { TagCategory } from "@/generated/prisma/client";

export interface HomeStats {
  totalPosts: number;
  artistCount: number;
  characterCount: number;
  copyrightCount: number;
  tagCount: number;
  groupCount: number;
  updatedAt: string;
}

export interface PopularTag {
  id: number;
  name: string;
  category: TagCategory;
  postCount: number;
}

export interface PopularTagsByCategory {
  ARTIST: PopularTag[];
  CHARACTER: PopularTag[];
  COPYRIGHT: PopularTag[];
  GENERAL: PopularTag[];
}

const STATS_KEY = "stats.homeStats";
const POPULAR_TAGS_KEY = "stats.popularTags";

/**
 * Get precomputed stats from Settings.
 * Falls back to computing if not yet cached.
 */
export async function getHomeStats(): Promise<HomeStats> {
  const setting = await prisma.settings.findUnique({
    where: { key: STATS_KEY },
  });

  if (setting) {
    try {
      return JSON.parse(setting.value) as HomeStats;
    } catch {
      // Fall through to compute
    }
  }

  // Fallback: compute and store
  return computeAndStoreHomeStats();
}

/**
 * Get precomputed popular tags from Settings.
 * Falls back to computing if not yet cached.
 */
export async function getPopularTags(
  limit = 10
): Promise<PopularTagsByCategory> {
  const setting = await prisma.settings.findUnique({
    where: { key: POPULAR_TAGS_KEY },
  });

  if (setting) {
    try {
      const cached = JSON.parse(setting.value) as PopularTagsByCategory;
      // Apply limit to cached results
      return {
        ARTIST: cached.ARTIST.slice(0, limit),
        CHARACTER: cached.CHARACTER.slice(0, limit),
        COPYRIGHT: cached.COPYRIGHT.slice(0, limit),
        GENERAL: cached.GENERAL.slice(0, limit),
      };
    } catch {
      // Fall through to compute
    }
  }

  // Fallback: compute and store
  const result = await computeAndStorePopularTags();
  return {
    ARTIST: result.ARTIST.slice(0, limit),
    CHARACTER: result.CHARACTER.slice(0, limit),
    COPYRIGHT: result.COPYRIGHT.slice(0, limit),
    GENERAL: result.GENERAL.slice(0, limit),
  };
}

/**
 * Compute and store home stats in Settings.
 * Called after sync to precompute values.
 */
export async function computeAndStoreHomeStats(): Promise<HomeStats> {
  const [postCount, tagCounts, groupCount] = await Promise.all([
    prisma.post.count(),
    prisma.tag.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    prisma.group.count(),
  ]);

  const getCountForCategory = (category: TagCategory): number =>
    tagCounts.find((c) => c.category === category)?._count._all ?? 0;

  const stats: HomeStats = {
    totalPosts: postCount,
    artistCount: getCountForCategory(TagCategory.ARTIST),
    characterCount: getCountForCategory(TagCategory.CHARACTER),
    copyrightCount: getCountForCategory(TagCategory.COPYRIGHT),
    tagCount: tagCounts.reduce((sum, c) => sum + c._count._all, 0),
    groupCount,
    updatedAt: new Date().toISOString(),
  };

  await prisma.settings.upsert({
    where: { key: STATS_KEY },
    update: { value: JSON.stringify(stats) },
    create: { key: STATS_KEY, value: JSON.stringify(stats) },
  });

  return stats;
}

/**
 * Compute and store popular tags in Settings.
 * Called after sync to precompute values.
 */
export async function computeAndStorePopularTags(): Promise<PopularTagsByCategory> {
  const categories = [
    TagCategory.ARTIST,
    TagCategory.CHARACTER,
    TagCategory.COPYRIGHT,
    TagCategory.GENERAL,
  ] as const;

  // Fetch more tags than typically needed so we can serve different limits
  const limit = 20;

  const results = await Promise.all(
    categories.map((category) =>
      prisma.tag.findMany({
        where: { category, postCount: { gt: 0 } },
        orderBy: { postCount: "desc" },
        take: limit,
        select: { id: true, name: true, category: true, postCount: true },
      })
    )
  );

  const popularTags: PopularTagsByCategory = {
    ARTIST: results[0],
    CHARACTER: results[1],
    COPYRIGHT: results[2],
    GENERAL: results[3],
  };

  await prisma.settings.upsert({
    where: { key: POPULAR_TAGS_KEY },
    update: { value: JSON.stringify(popularTags) },
    create: { key: POPULAR_TAGS_KEY, value: JSON.stringify(popularTags) },
  });

  return popularTags;
}

/**
 * Update all precomputed home stats.
 * Should be called after sync completes.
 */
export async function updateHomeStatsCache(): Promise<void> {
  await Promise.all([
    computeAndStoreHomeStats(),
    computeAndStorePopularTags(),
  ]);
}

/**
 * Get random posts for the homepage highlights.
 */
export async function getRandomPosts(limit = 12): Promise<
  Array<{
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
  }>
> {
  // Generate a random seed for this request
  const seed = Math.random().toString(36).substring(2, 10);

  return prisma.$queryRaw<
    Array<{
      id: number;
      hash: string;
      width: number | null;
      height: number | null;
      blurhash: string | null;
      mimeType: string;
    }>
  >`
    SELECT id, hash, width, height, blurhash, "mimeType"
    FROM "Post"
    ORDER BY MD5(hash || ${seed})
    LIMIT ${limit}
  `;
}

/**
 * Get count of posts imported in the last 24 hours.
 * This is dynamic since it's time-based.
 */
export async function getRecentImportCount(): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.post.count({
    where: {
      importedAt: { gte: oneDayAgo },
    },
  });
}
