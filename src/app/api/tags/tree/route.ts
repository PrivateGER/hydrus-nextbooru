import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdsByNameCache, postIdsCache, treeResponseCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const selectedParam = searchParams.get("selected") || "";
  const category = searchParams.get("category") || "";
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  // Parse selected tags (comma-separated), deduplicate to avoid query issues
  const selectedTags = [...new Set(
    selectedParam
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
  )];

  // Build cache key for response caching
  // Use JSON to avoid collisions with tags containing commas/pipes
  const sortedSelectedTags = [...selectedTags].sort();
  const cacheKey = JSON.stringify([sortedSelectedTags, category, query, limit]);

  // Check response cache first
  const cached = treeResponseCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({
      tags: cached.tags,
      postCount: cached.postCount,
      selectedTags,
    });
  }

  // If no tags are selected, return top tags or search results
  if (selectedTags.length === 0) {
    // If searching or filtering by category, use simple query
    if (query || category) {
      const baseWhere: Prisma.TagWhereInput = {};
      if (category) {
        baseWhere.category = category as Prisma.EnumTagCategoryFilter;
      }
      if (query) {
        baseWhere.name = {
          contains: query,
          mode: "insensitive",
        };
      }

      const [tags, totalPosts] = await Promise.all([
        prisma.tag.findMany({
          where: withBlacklistFilter(baseWhere),
          select: {
            id: true,
            name: true,
            category: true,
            postCount: true,
          },
          orderBy: [{ postCount: "desc" }],
          take: limit,
        }),
        prisma.post.count(),
      ]);

      const result = {
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          category: tag.category,
          count: tag.postCount,
        })),
        postCount: totalPosts,
      };

      treeResponseCache.set(cacheKey, result);

      return NextResponse.json({
        ...result,
        selectedTags: [],
      });
    }

    // No filters: fetch top tags per category for balanced display
    const categoryLimits = {
      ARTIST: 20,
      COPYRIGHT: 10,
      CHARACTER: 10,
      GENERAL: 50,
      META: 10,
    } as const;

    const [artistTags, copyrightTags, characterTags, generalTags, metaTags, totalPosts] = await Promise.all([
      prisma.tag.findMany({
        where: withBlacklistFilter({ category: "ARTIST" }),
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.ARTIST,
      }),
      prisma.tag.findMany({
        where: withBlacklistFilter({ category: "COPYRIGHT" }),
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.COPYRIGHT,
      }),
      prisma.tag.findMany({
        where: withBlacklistFilter({ category: "CHARACTER" }),
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.CHARACTER,
      }),
      prisma.tag.findMany({
        where: withBlacklistFilter({ category: "GENERAL" }),
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.GENERAL,
      }),
      prisma.tag.findMany({
        where: withBlacklistFilter({ category: "META" }),
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.META,
      }),
      prisma.post.count(),
    ]);

    const allTags = [...artistTags, ...copyrightTags, ...characterTags, ...generalTags, ...metaTags];

    const result = {
      tags: allTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag.postCount,
      })),
      postCount: totalPosts,
    };

    treeResponseCache.set(cacheKey, result);

    return NextResponse.json({
      ...result,
      selectedTags: [],
    });
  }

  // Step 1: Resolve tag names to ALL matching tag IDs (across categories)
  // A tag name like "shibari" might exist in GENERAL and ARTIST categories
  const tagIdsByName = new Map<string, number[]>();
  const uncachedTagNames: string[] = [];

  for (const tagName of selectedTags) {
    const cached = tagIdsByNameCache.get(tagName);
    if (cached !== undefined) {
      tagIdsByName.set(tagName, cached);
    } else {
      uncachedTagNames.push(tagName);
    }
  }

  // Fetch any uncached tag IDs - get ALL IDs per name (across categories)
  if (uncachedTagNames.length > 0) {
    const tagRecords = await prisma.tag.findMany({
      where: {
        name: { in: uncachedTagNames, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });

    // Group all IDs by lowercase name
    const grouped = new Map<string, number[]>();
    for (const tag of tagRecords) {
      const normalizedName = tag.name.toLowerCase();
      if (!grouped.has(normalizedName)) {
        grouped.set(normalizedName, []);
      }
      grouped.get(normalizedName)!.push(tag.id);
    }

    // Cache and store results
    for (const [name, ids] of grouped) {
      tagIdsByNameCache.set(name, ids);
      tagIdsByName.set(name, ids);
    }
  }

  // If not all selected tag names exist, no results possible
  if (tagIdsByName.size !== selectedTags.length) {
    return NextResponse.json({
      tags: [],
      postCount: 0,
      selectedTags,
    });
  }

  // Step 2: Find posts that have at least one tag from EACH selected name
  // Use INTERSECT for efficient multi-name queries
  const tagGroups = [...tagIdsByName.values()];
  const allTagIds = tagGroups.flat();

  // Cache key based on sorted tag names (not IDs, since we search all IDs per name)
  const postIdsCacheKey = sortedSelectedTags.join("\0");

  let postIds = postIdsCache.get(postIdsCacheKey);

  if (!postIds) {
    if (tagGroups.length === 1) {
      // Single tag name: find posts with ANY of the matching tag IDs
      const posts = await prisma.postTag.findMany({
        where: { tagId: { in: tagGroups[0] } },
        select: { postId: true },
        distinct: ["postId"],
      });
      postIds = posts.map((p) => p.postId);
    } else {
      // Multiple tag names: use INTERSECT to find posts with at least one from each group
      // This is much faster than nested subqueries for large datasets
      const intersectClauses = tagGroups
        .map((_, i) => `SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY($${i + 1}::int[])`)
        .join(" INTERSECT ");

      const result = await prisma.$queryRawUnsafe<{ postId: number }[]>(
        intersectClauses,
        ...tagGroups
      );
      postIds = result.map((r) => r.postId);
    }
    postIdsCache.set(postIdsCacheKey, postIds);
  }

  const postCount = postIds.length;

  if (postCount === 0) {
    return NextResponse.json({
      tags: [],
      postCount: 0,
      selectedTags,
    });
  }

  // Step 3: Find tags that appear on these posts (excluding already selected)
  const baseWhere: Prisma.TagWhereInput = {
    // Exclude all tag IDs matching selected names (across all categories)
    id: { notIn: allTagIds },
    // Only tags on posts with all selected tags
    posts: {
      some: {
        postId: { in: postIds },
      },
    },
  };

  if (category) {
    baseWhere.category = category as Prisma.EnumTagCategoryFilter;
  }

  if (query) {
    baseWhere.name = {
      contains: query,
      mode: "insensitive",
    };
  }

  // Use _count aggregation - database does the counting, not JS
  const tags = await prisma.tag.findMany({
    where: withBlacklistFilter(baseWhere),
    select: {
      id: true,
      name: true,
      category: true,
      _count: {
        select: {
          posts: {
            where: {
              postId: { in: postIds },
            },
          },
        },
      },
    },
    orderBy: {
      posts: { _count: "desc" },
    },
    take: limit * 2, // Over-fetch to account for blacklist filtering
  });

  // Map and filter results
  const mappedTags = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: tag._count.posts,
  }));

  const sortedTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  const result = {
    tags: sortedTags,
    postCount,
  };

  // Cache the response
  treeResponseCache.set(cacheKey, result);

  return NextResponse.json({
    ...result,
    selectedTags,
  });
}
