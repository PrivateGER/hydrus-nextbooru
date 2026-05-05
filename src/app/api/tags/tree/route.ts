import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { tagIdsByNameCache, treeResponseCache } from "@/lib/cache";

/**
 * Provide tag suggestions and the count of matching posts based on query parameters and selected tags.
 *
 * Accepts these query parameters on the incoming request:
 * - `selected`: comma-separated tag names (case-insensitive) to restrict results; names are normalized (trimmed, lowercased, deduplicated).
 * - `category`: optional tag category to filter results.
 * - `q`: optional text to match tag names (case-insensitive, substring).
 * - `limit`: maximum number of tags to return (defaults to 50, capped at 100).
 *
 * The handler returns tags that either match the search/category filters (when no `selected` tags are provided)
 * or co-occur on posts that contain at least one tag from each provided selected name (when `selected` is provided).
 * Results are cached for efficiency.
 *
 * @param request - Incoming NextRequest containing URL search parameters described above.
 * @returns An object with:
 *   - `tags`: an array of tag objects each containing `id`, `name`, `category`, and `count` (number of matching posts for that tag).
 *   - `postCount`: the total number of posts matching the current filters/selected tags.
 *   - `selectedTags`: the normalized list of selected tag names provided in the request.
 */
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
          where: baseWhere,
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
        where: { category: "ARTIST" },
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.ARTIST,
      }),
      prisma.tag.findMany({
        where: { category: "COPYRIGHT" },
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.COPYRIGHT,
      }),
      prisma.tag.findMany({
        where: { category: "CHARACTER" },
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.CHARACTER,
      }),
      prisma.tag.findMany({
        where: { category: "GENERAL" },
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: [{ postCount: "desc" }],
        take: categoryLimits.GENERAL,
      }),
      prisma.tag.findMany({
        where: { category: "META" },
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
  // A tag name like "maid" might exist in GENERAL and ARTIST categories
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

  // Step 2: Find posts that have at least one tag from EACH selected name.
  // Keep this in SQL so popular selected tags do not materialize large post ID
  // arrays in the application process.
  const tagGroups = [...tagIdsByName.values()];
  const allTagIds = tagGroups.flat();

  const filteredPostsSubquery =
    tagGroups.length === 1
      ? Prisma.sql`SELECT DISTINCT "postId" FROM "PostTag" WHERE "tagId" = ANY(${tagGroups[0]}::int[])`
      : Prisma.join(
          tagGroups.map(
            (group) => Prisma.sql`SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY(${group}::int[])`
          ),
          " INTERSECT "
        );

  const categoryFilter = category
    ? Prisma.sql`AND t.category = ${category}::"TagCategory"`
    : Prisma.sql``;
  const queryFilter = query
    ? Prisma.sql`AND t.name ILIKE ${`%${escapeSqlLike(query)}%`}`
    : Prisma.sql``;

  type SelectedTagsResult = {
    postCount: number;
    tags: Array<{ id: number; name: string; category: string; count: number }>;
  };

  const [selectedResult] = await prisma.$queryRaw<SelectedTagsResult[]>`
    WITH filtered_posts AS (
      ${filteredPostsSubquery}
    ),
    filtered_total AS (
      SELECT COUNT(*)::int AS total FROM filtered_posts
    ),
    suggested_tags AS (
      SELECT
        t.id,
        t.name,
        t.category,
        COUNT(pt."postId")::int AS count
      FROM filtered_posts fp
      JOIN "PostTag" pt ON pt."postId" = fp."postId"
      JOIN "Tag" t ON t.id = pt."tagId"
      WHERE t.id != ALL(${allTagIds}::int[])
        ${categoryFilter}
        ${queryFilter}
      GROUP BY t.id, t.name, t.category
      ORDER BY count DESC, t.id ASC
      LIMIT ${limit}
    )
    SELECT
      ft.total AS "postCount",
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'name', st.name,
            'category', st.category,
            'count', st.count
          )
          ORDER BY st.count DESC, st.id ASC
        ) FILTER (WHERE st.id IS NOT NULL),
        '[]'::jsonb
      ) AS tags
    FROM filtered_total ft
    LEFT JOIN suggested_tags st ON TRUE
    GROUP BY ft.total
  `;

  const sortedTags = selectedResult?.tags ?? [];

  const result = {
    tags: sortedTags,
    postCount: selectedResult?.postCount ?? 0,
  };

  // Cache the response
  treeResponseCache.set(cacheKey, result);

  return NextResponse.json({
    ...result,
    selectedTags,
  });
}
