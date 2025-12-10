import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdsByNameCache } from "@/lib/cache";

/**
 * Parse selected tags into included and excluded lists.
 * Tags prefixed with `-` are excluded.
 */
function parseSelectedTagsWithNegation(selectedParam: string): {
  includeTags: string[];
  excludeTags: string[];
} {
  const allTags = selectedParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];

  for (const tag of allTags) {
    if (tag.startsWith("-") && tag.length > 1) {
      excludeTags.push(tag.slice(1));
    } else {
      includeTags.push(tag);
    }
  }

  return { includeTags, excludeTags };
}

/**
 * Provide tag suggestions matching a text query, optionally restricted to tags that co-occur with one or more selected tag names.
 * Supports tag negation with `-` prefix to exclude posts with certain tags.
 *
 * Reads query parameters from the request URL:
 * - `q`: search string (required; empty string yields no results)
 * - `limit`: maximum number of tags to return (default 20, capped at 50)
 * - `selected`: comma-separated tag names to require co-occurrence with (prefix with `-` to exclude)
 *
 * @param request - Incoming Next.js request whose URL query supplies `q`, `limit`, and `selected`
 * @returns An object with a `tags` array; each element contains `id`, `name`, `category`, and numeric `count` representing matching tag metadata and co-occurrence counts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const selectedParam = searchParams.get("selected") || "";

  // Parse selected tags with negation support
  const { includeTags: selectedTags, excludeTags } = parseSelectedTagsWithNegation(selectedParam);

  if (query.length < 1) {
    return NextResponse.json({ tags: [] });
  }

  // If no tags are selected (include or exclude), use simple search with pre-computed postCount
  if (selectedTags.length === 0 && excludeTags.length === 0) {
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

  // Progressive filtering: find tags that co-occur with all selected tags (and not excluded tags)

  // Step 1: Find ALL tag IDs for selected tag names (across categories)
  const tagIdsByName = new Map<string, number[]>();
  const excludeTagIdsByName = new Map<string, number[]>();
  const uncachedTagNames: string[] = [];

  // Gather included tag IDs
  for (const tagName of selectedTags) {
    const cached = tagIdsByNameCache.get(tagName);
    if (cached !== undefined) {
      tagIdsByName.set(tagName, cached);
    } else {
      uncachedTagNames.push(tagName);
    }
  }

  // Gather excluded tag IDs
  for (const tagName of excludeTags) {
    const cached = tagIdsByNameCache.get(tagName);
    if (cached !== undefined) {
      excludeTagIdsByName.set(tagName, cached);
    } else if (!uncachedTagNames.includes(tagName)) {
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
      // Add to the appropriate map based on whether it's an include or exclude tag
      if (selectedTags.includes(name)) {
        tagIdsByName.set(name, ids);
      }
      if (excludeTags.includes(name)) {
        excludeTagIdsByName.set(name, ids);
      }
    }
  }

  // If not all selected tag names exist, no results possible
  if (tagIdsByName.size !== selectedTags.length) {
    return NextResponse.json({ tags: [] });
  }

  // Get all tag IDs across all categories for exclusion from suggestions
  const allTagIds = [...tagIdsByName.values()].flat();
  const tagGroups = [...tagIdsByName.values()];

  // Get all excluded tag IDs
  const allExcludeTagIds = [...excludeTagIdsByName.values()].flat();

  // Step 2: Build query to find posts with at least one tag from each name group
  const searchPattern = `%${escapeSqlLike(query)}%`;

  // Build INTERSECT subqueries for each included tag group using Prisma.sql
  const intersectParts = tagGroups.map(
    (group) => Prisma.sql`SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY(${group}::int[])`
  );

  // Build EXCEPT subqueries for each excluded tag group
  const exceptParts = allExcludeTagIds.length > 0
    ? [Prisma.sql`SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY(${allExcludeTagIds}::int[])`]
    : [];

  // Build the full post subquery
  let postSubquery: Prisma.Sql;
  if (intersectParts.length > 0 && exceptParts.length > 0) {
    const intersectQuery = Prisma.join(intersectParts, " INTERSECT ");
    postSubquery = Prisma.sql`(${intersectQuery}) EXCEPT (${exceptParts[0]})`;
  } else if (intersectParts.length > 0) {
    postSubquery = Prisma.join(intersectParts, " INTERSECT ");
  } else if (exceptParts.length > 0) {
    // Only exclude tags - get all posts except those with excluded tags
    postSubquery = Prisma.sql`SELECT DISTINCT "postId" FROM "PostTag" EXCEPT (${exceptParts[0]})`;
  } else {
    // Should not reach here due to earlier check, but handle gracefully
    return NextResponse.json({ tags: [] });
  }

  // Also exclude the excluded tag IDs from suggestions
  const allExcludedFromSuggestions = [...allTagIds, ...allExcludeTagIds];

  const coOccurringTags = await prisma.$queryRaw<Array<{
    id: number;
    name: string;
    category: string;
    count: bigint;
  }>>`
    SELECT t.id, t.name, t.category, COUNT(*)::bigint as count
    FROM "Tag" t
    JOIN "PostTag" pt ON t.id = pt."tagId"
    WHERE t.name ILIKE ${searchPattern}
      AND t.id != ALL(${allExcludedFromSuggestions}::int[])
      AND pt."postId" IN (${postSubquery})
    GROUP BY t.id, t.name, t.category
    ORDER BY count DESC
    LIMIT ${limit * 2}
  `;

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