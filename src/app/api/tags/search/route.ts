import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdsByNameCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const selectedParam = searchParams.get("selected") || "";

  // Parse selected tags (comma-separated)
  const selectedTags = selectedParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  if (query.length < 1) {
    return NextResponse.json({ tags: [] });
  }

  // If no tags are selected, use simple search with pre-computed postCount
  if (selectedTags.length === 0) {
    const tags = await prisma.tag.findMany({
      where: withBlacklistFilter({
        name: {
          contains: query,
          mode: "insensitive",
        },
      }),
      select: {
        id: true,
        name: true,
        category: true,
        postCount: true,
      },
      orderBy: { postCount: "desc" },
      take: limit,
    });

    return NextResponse.json({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag.postCount,
      })),
    });
  }

  // Progressive filtering: find tags that co-occur with all selected tags

  // Step 1: Find ALL tag IDs for selected tag names (across categories)
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

  // Fetch any uncached tag IDs - get ALL IDs per name
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
    return NextResponse.json({ tags: [] });
  }

  // Get all tag IDs across all categories for exclusion
  const allTagIds = [...tagIdsByName.values()].flat();
  const tagGroups = [...tagIdsByName.values()];

  // Step 2: Build query to find posts with at least one tag from each name group
  const searchPattern = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  // For multiple tag names, use INTERSECT-based subquery
  let postSubquery: string;
  const queryParams: unknown[] = [searchPattern, allTagIds];

  if (tagGroups.length === 1) {
    postSubquery = `SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY($3::int[])`;
    queryParams.push(tagGroups[0]);
  } else {
    // Build INTERSECT query for multiple tag name groups
    const intersectParts = tagGroups.map((_, i) =>
      `SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY($${i + 3}::int[])`
    );
    postSubquery = intersectParts.join(" INTERSECT ");
    queryParams.push(...tagGroups);
  }

  const coOccurringTags = await prisma.$queryRawUnsafe<Array<{
    id: number;
    name: string;
    category: string;
    count: bigint;
  }>>(
    `SELECT t.id, t.name, t.category, COUNT(*)::bigint as count
     FROM "Tag" t
     JOIN "PostTag" pt ON t.id = pt."tagId"
     WHERE t.name ILIKE $1
       AND t.id != ALL($2::int[])
       AND pt."postId" IN (${postSubquery})
     GROUP BY t.id, t.name, t.category
     ORDER BY count DESC
     LIMIT ${limit * 2}`,
    ...queryParams
  );

  // Apply blacklist filter in memory (simpler than dynamic SQL for complex patterns)
  const mappedTags = coOccurringTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: Number(tag.count),
  }));

  const filteredTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  return NextResponse.json({ tags: filteredTags });
}
