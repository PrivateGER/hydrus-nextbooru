import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike, getTotalPostCount } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdsByNameCache, wildcardPatternCache, WildcardCacheEntry } from "@/lib/cache";
import {
  isWildcardPattern,
  wildcardToSqlPattern,
  validateWildcardPattern,
  WILDCARD_TAG_LIMIT,
} from "@/lib/wildcard";
import { wildcardLog } from "@/lib/logger";

/**
 * Parse a comma-separated list of tag names into included and excluded tag name arrays.
 *
 * @param selectedParam - Comma-separated tag names; a name prefixed with `-` denotes exclusion. Whitespace is trimmed and names are lowercased.
 * @returns An object with `includeTags` (lowercased tag names to include) and `excludeTags` (lowercased tag names to exclude, without the `-` prefix).
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
 * Suggest tags that match a text query, optionally constrained to tags that co-occur with specified tag names and supporting negation.
 *
 * @param request - Next.js request whose URL query provides:
 *   - `q`: search string (empty string yields no results)
 *   - `limit`: maximum number of tags to return (default 20, capped at 50)
 *   - `selected`: comma-separated tag names to require co-occurrence with; prefix a name with `-` to exclude posts containing that tag
 * @returns An object with a `tags` array; each element contains `id`, `name`, `category`, and numeric `count` indicating matching tag metadata and co-occurrence counts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const selectedParam = searchParams.get("selected") || "";

  // Parse selected tags with negation support
  const { includeTags: selectedTags, excludeTags } = parseSelectedTagsWithNegation(selectedParam);

  // Return popular tags if no query AND no selected tags (for initial suggestions)
  if (query.length < 1 && selectedTags.length === 0 && excludeTags.length === 0) {
    const totalPosts = await getTotalPostCount();

    const tags = await prisma.tag.findMany({
      where: withBlacklistFilter({}),
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
        remainingCount: Math.max(0, totalPosts - tag.postCount),
      })),
    });
  }

  // If no tags are selected (include or exclude), use simple search with pre-computed postCount
  if (selectedTags.length === 0 && excludeTags.length === 0) {
    // Get precomputed total from Settings for remainingCount calculation
    let totalPosts = await getTotalPostCount();

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
        remainingCount: Math.max(0, totalPosts - tag.postCount),
      })),
    });
  }

  // Progressive filtering: find tags that co-occur with all selected tags (and not excluded tags)

  // Separate wildcards from regular tags
  const regularIncludeTags: string[] = [];
  const wildcardIncludePatterns: string[] = [];
  const regularExcludeTags: string[] = [];
  const wildcardExcludePatterns: string[] = [];

  for (const tag of selectedTags) {
    if (isWildcardPattern(tag)) {
      const validation = validateWildcardPattern(tag);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      wildcardIncludePatterns.push(tag);
    } else {
      regularIncludeTags.push(tag);
    }
  }

  for (const tag of excludeTags) {
    if (isWildcardPattern(tag)) {
      const validation = validateWildcardPattern(`-${tag}`);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      wildcardExcludePatterns.push(tag);
    } else {
      regularExcludeTags.push(tag);
    }
  }

  // Step 1: Resolve wildcards to tag IDs
  const wildcardIncludeTagIds: number[][] = [];
  const wildcardExcludeTagIds: number[] = [];

  for (const pattern of wildcardIncludePatterns) {
    const cached = wildcardPatternCache.get(pattern);
    if (cached) {
      wildcardLog.debug({ pattern, count: cached.tagNames.length, source: "tags" }, "Cache HIT");
      wildcardIncludeTagIds.push(cached.tagIds);
    } else {
      // Resolve the wildcard pattern
      const sqlPattern = wildcardToSqlPattern(pattern);
      wildcardLog.debug({ pattern, sqlPattern, source: "tags" }, "Cache MISS, querying");
      const matchingTags = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
        SELECT id, name FROM "Tag"
        WHERE name ILIKE ${sqlPattern}
        ORDER BY "postCount" DESC
        LIMIT ${WILDCARD_TAG_LIMIT + 1}
      `;
      wildcardLog.debug(
        { pattern, count: matchingTags.length, sample: matchingTags.slice(0, 10).map(t => t.name), source: "tags" },
        "Resolved wildcard"
      );
      const truncated = matchingTags.length > WILDCARD_TAG_LIMIT;
      const result: WildcardCacheEntry = {
        tagIds: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.id),
        tagNames: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.name),
        truncated,
      };
      wildcardPatternCache.set(pattern, result);
      wildcardIncludeTagIds.push(result.tagIds);
    }
  }

  for (const pattern of wildcardExcludePatterns) {
    const cached = wildcardPatternCache.get(pattern);
    if (cached) {
      wildcardLog.debug({ pattern, count: cached.tagNames.length, negated: true, source: "tags" }, "Cache HIT");
      wildcardExcludeTagIds.push(...cached.tagIds);
    } else {
      const sqlPattern = wildcardToSqlPattern(pattern);
      wildcardLog.debug({ pattern, sqlPattern, negated: true, source: "tags" }, "Cache MISS, querying");
      const matchingTags = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
        SELECT id, name FROM "Tag"
        WHERE name ILIKE ${sqlPattern}
        ORDER BY "postCount" DESC
        LIMIT ${WILDCARD_TAG_LIMIT + 1}
      `;
      wildcardLog.debug(
        { pattern, count: matchingTags.length, sample: matchingTags.slice(0, 10).map(t => t.name), negated: true, source: "tags" },
        "Resolved wildcard"
      );
      const truncated = matchingTags.length > WILDCARD_TAG_LIMIT;
      const result: WildcardCacheEntry = {
        tagIds: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.id),
        tagNames: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.name),
        truncated,
      };
      wildcardPatternCache.set(pattern, result);
      wildcardExcludeTagIds.push(...result.tagIds);
    }
  }

  // Step 2: Find tag IDs for regular (non-wildcard) selected tag names
  const tagIdsByName = new Map<string, number[]>();
  const excludeTagIdsByName = new Map<string, number[]>();
  const uncachedTagNames: string[] = [];

  // Gather included tag IDs
  for (const tagName of regularIncludeTags) {
    const cached = tagIdsByNameCache.get(tagName);
    if (cached !== undefined) {
      tagIdsByName.set(tagName, cached);
    } else {
      uncachedTagNames.push(tagName);
    }
  }

  // Gather excluded tag IDs
  for (const tagName of regularExcludeTags) {
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
      if (regularIncludeTags.includes(name)) {
        tagIdsByName.set(name, ids);
      }
      if (regularExcludeTags.includes(name)) {
        excludeTagIdsByName.set(name, ids);
      }
    }
  }

  // If not all regular selected tag names exist, no results possible
  if (tagIdsByName.size !== regularIncludeTags.length) {
    return NextResponse.json({ tags: [] });
  }

  // Check if any wildcard include pattern matched nothing
  for (const ids of wildcardIncludeTagIds) {
    if (ids.length === 0) {
      return NextResponse.json({ tags: [] });
    }
  }

  // Get all tag IDs across all categories for exclusion from suggestions
  const allTagIds = [...tagIdsByName.values()].flat();
  // Include both regular tag groups and wildcard tag groups
  const tagGroups = [...tagIdsByName.values(), ...wildcardIncludeTagIds];

  // Get all excluded tag IDs (regular + wildcard)
  const allExcludeTagIds = [
    ...excludeTagIdsByName.values(),
  ].flat().concat(wildcardExcludeTagIds);

  // Include wildcard matched IDs in exclusion from suggestions
  const allWildcardTagIds = wildcardIncludeTagIds.flat();

  // Step 2: Build query to find posts with at least one tag from each name group
  const hasSearchQuery = query.length > 0;
  const searchPattern = hasSearchQuery ? `%${escapeSqlLike(query)}%` : "";

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

  // Also exclude the excluded tag IDs and wildcard matched IDs from suggestions
  const allExcludedFromSuggestions = [...allTagIds, ...allExcludeTagIds, ...allWildcardTagIds];

  // Use CTE to compute filtered posts once and reuse for both count and exclude_count
  // Conditionally include ILIKE filter only when there's a search query
  const nameFilter = hasSearchQuery
    ? Prisma.sql`t.name ILIKE ${searchPattern} AND`
    : Prisma.sql``;

  // When browsing (no query), filter out omnipresent tags (remainingCount = 0)
  const excludeOmnipresent = hasSearchQuery
    ? Prisma.sql``
    : Prisma.sql`HAVING (SELECT total FROM filtered_total) - COUNT(pt."postId") > 0`;

  const coOccurringTags = await prisma.$queryRaw<Array<{
    id: number;
    name: string;
    category: string;
    count: bigint;
    remaining_count: bigint;
  }>>`
    WITH filtered_posts AS (
      ${postSubquery}
    ),
    filtered_total AS (
      SELECT COUNT(*)::bigint as total FROM filtered_posts
    )
    SELECT t.id, t.name, t.category,
           COUNT(pt."postId")::bigint as count,
           (SELECT total FROM filtered_total) - COUNT(pt."postId")::bigint as remaining_count
    FROM "Tag" t
    JOIN "PostTag" pt ON t.id = pt."tagId"
    WHERE ${nameFilter} t.id != ALL(${allExcludedFromSuggestions}::int[])
      AND pt."postId" IN (SELECT "postId" FROM filtered_posts)
    GROUP BY t.id, t.name, t.category
    ${excludeOmnipresent}
    ORDER BY count DESC
    LIMIT ${limit * 4}
  `;

  // Apply blacklist filter in memory (simpler than dynamic SQL for complex patterns)
  const mappedTags = coOccurringTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: Number(tag.count),
    remainingCount: Math.max(0, Number(tag.remaining_count)),
  }));

  const filteredTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  return NextResponse.json({ tags: filteredTags });
}
