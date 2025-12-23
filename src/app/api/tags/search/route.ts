import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike, getTotalPostCount } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags, isTagBlacklisted } from "@/lib/tag-blacklist";
import { tagIdsByNameCache } from "@/lib/cache";
import {
  isWildcardPattern,
  validateWildcardPattern,
  parseTagsParamWithNegation,
  resolveWildcardPattern,
} from "@/lib/wildcard";
import {
  searchMetaTags,
  getAllMetaTags,
  getMetaTagCounts,
  separateMetaTags,
  getMetaTagDefinition,
  requiresRawSql,
  getOrientationSqlCondition,
} from "@/lib/meta-tags";

/**
 * Suggest tags that match a text query, optionally constrained to tags that co-occur with specified tag names and supporting negation.
 *
 * The request's URL query controls behavior:
 * - `q`: search string (empty string disables name filtering)
 * - `limit`: maximum number of tags to return (default 20, capped at 50)
 * - `selected`: comma-separated tag names to require co-occurrence; prefix a name with `-` to exclude posts containing that tag
 *
 * @param request - Next.js request containing the above query parameters
 * @returns An object with a `tags` array. Each tag object contains:
 *   - `id`: tag id
 *   - `name`: tag name
 *   - `category`: tag category
 *   - `count`: number of matching posts that include this tag
 *   - `remainingCount`: number of matching posts that do not include this tag (zero or greater)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const selectedParam = searchParams.get("selected") || "";

  // Parse selected tags with negation support
  const { includeTags: rawSelectedTags, excludeTags: rawExcludeTags } = parseTagsParamWithNegation(selectedParam);

  // Filter out blacklisted tags from selected tags - users should not be able to filter using blacklisted tags
  const selectedTags = rawSelectedTags.filter(tag => !isTagBlacklisted(tag));
  const excludeTags = rawExcludeTags.filter(tag => !isTagBlacklisted(tag));

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

    // Add all meta tags to initial suggestions with counts
    const allMetaTags = getAllMetaTags();
    const metaTagCounts = await getMetaTagCounts(
      allMetaTags.map((def) => def.name),
      prisma
    );

    const metaTags = allMetaTags.map((def, index) => ({
      id: -(index + 1), // Negative IDs to distinguish from real tags
      name: def.name,
      category: "META" as const,
      count: metaTagCounts.get(def.name) ?? 0,
      remainingCount: Math.max(0, totalPosts - (metaTagCounts.get(def.name) ?? 0)),
      isMeta: true,
      description: def.description,
    }));

    return NextResponse.json({
      tags: [
        ...tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          category: tag.category,
          count: tag.postCount,
          remainingCount: Math.max(0, totalPosts - tag.postCount),
        })),
        ...metaTags,
      ],
    });
  }

  // If no tags are selected (include or exclude), use simple search with pre-computed postCount
  if (selectedTags.length === 0 && excludeTags.length === 0) {
    // Get precomputed total from Settings for remainingCount calculation
    const totalPosts = await getTotalPostCount();

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

    // Search for matching meta tags with counts
    const matchingMetas = searchMetaTags(query);
    const metaTagCounts = matchingMetas.length > 0
      ? await getMetaTagCounts(matchingMetas.map((def) => def.name), prisma)
      : new Map<string, number>();

    const matchingMetaTags = matchingMetas.map((def, index) => ({
      id: -(index + 1),
      name: def.name,
      category: "META" as const,
      count: metaTagCounts.get(def.name) ?? 0,
      remainingCount: Math.max(0, totalPosts - (metaTagCounts.get(def.name) ?? 0)),
      isMeta: true,
      description: def.description,
    }));

    return NextResponse.json({
      tags: [
        ...tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          category: tag.category,
          count: tag.postCount,
          remainingCount: Math.max(0, totalPosts - tag.postCount),
        })),
        ...matchingMetaTags,
      ],
    });
  }

  // Progressive filtering: find tags that co-occur with all selected tags (and not excluded tags)

  // Separate meta tags from regular tags first
  const allSelectedWithNegation = [
    ...selectedTags,
    ...excludeTags.map(t => `-${t}`),
  ];
  const { metaTags, regularTags } = separateMetaTags(allSelectedWithNegation);

  // Separate wildcards from regular tags (only for non-meta tags)
  const regularIncludeTags: string[] = [];
  const wildcardIncludePatterns: string[] = [];
  const regularExcludeTags: string[] = [];
  const wildcardExcludePatterns: string[] = [];

  for (const tag of regularTags.include) {
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

  for (const tag of regularTags.exclude) {
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

  // Check if we only have meta tags selected (no regular tags)
  const hasRegularTags = regularIncludeTags.length > 0 || wildcardIncludePatterns.length > 0 ||
                         regularExcludeTags.length > 0 || wildcardExcludePatterns.length > 0;
  const hasMetaTags = metaTags.include.length > 0 || metaTags.exclude.length > 0;

  // Step 1: Resolve wildcards to tag IDs (in parallel for performance)
  const [resolvedIncludes, resolvedExcludes] = await Promise.all([
    Promise.all(wildcardIncludePatterns.map(pattern => resolveWildcardPattern(pattern, "tags-api"))),
    Promise.all(wildcardExcludePatterns.map(pattern => resolveWildcardPattern(pattern, "tags-api"))),
  ]);

  const wildcardIncludeTagIds = resolvedIncludes.map(r => r.tagIds);
  const wildcardExcludeTagIds = resolvedExcludes.flatMap(r => r.tagIds);

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

  // Build meta tag SQL conditions
  const metaConditions: Prisma.Sql[] = [];

  // Include meta tags
  for (const metaName of metaTags.include) {
    if (requiresRawSql(metaName)) {
      metaConditions.push(getOrientationSqlCondition(metaName, false));
    } else {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        const condition = def.getCondition();
        // Convert Prisma condition to SQL - handle common cases
        if ("mimeType" in condition) {
          const mimeType = condition.mimeType as { startsWith?: string; in?: string[] };
          if (mimeType.startsWith) {
            metaConditions.push(Prisma.sql`"mimeType" LIKE ${mimeType.startsWith + "%"}`);
          } else if (mimeType.in) {
            metaConditions.push(Prisma.sql`"mimeType" = ANY(${mimeType.in}::text[])`);
          }
        } else if ("OR" in condition) {
          // highres: OR [{ width: { gte: 1920 } }, { height: { gte: 1920 } }]
          metaConditions.push(Prisma.sql`("width" >= 1920 OR "height" >= 1920)`);
        } else if ("AND" in condition) {
          // lowres: AND [width not null, height not null, width <= 500, height <= 500]
          metaConditions.push(Prisma.sql`("width" IS NOT NULL AND "height" IS NOT NULL AND "width" <= 500 AND "height" <= 500)`);
        }
      }
    }
  }

  // Exclude meta tags
  for (const metaName of metaTags.exclude) {
    if (requiresRawSql(metaName)) {
      metaConditions.push(getOrientationSqlCondition(metaName, true));
    } else {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        const condition = def.getCondition();
        // Convert Prisma condition to SQL with negation
        if ("mimeType" in condition) {
          const mimeType = condition.mimeType as { startsWith?: string; in?: string[] };
          if (mimeType.startsWith) {
            metaConditions.push(Prisma.sql`("mimeType" IS NULL OR "mimeType" NOT LIKE ${mimeType.startsWith + "%"})`);
          } else if (mimeType.in) {
            metaConditions.push(Prisma.sql`("mimeType" IS NULL OR "mimeType" != ALL(${mimeType.in}::text[]))`);
          }
        } else if ("OR" in condition) {
          // NOT highres
          metaConditions.push(Prisma.sql`NOT ("width" >= 1920 OR "height" >= 1920)`);
        } else if ("AND" in condition) {
          // NOT lowres
          metaConditions.push(Prisma.sql`NOT ("width" IS NOT NULL AND "height" IS NOT NULL AND "width" <= 500 AND "height" <= 500)`);
        }
      }
    }
  }

  // Build INTERSECT subqueries for each included tag group using Prisma.sql
  const intersectParts = tagGroups.map(
    (group) => Prisma.sql`SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY(${group}::int[])`
  );

  // Build EXCEPT subqueries for each excluded tag group
  const exceptParts = allExcludeTagIds.length > 0
    ? [Prisma.sql`SELECT "postId" FROM "PostTag" WHERE "tagId" = ANY(${allExcludeTagIds}::int[])`]
    : [];

  // Build meta tag filter subquery (if we have meta tags)
  const metaTagFilter = metaConditions.length > 0
    ? Prisma.sql`SELECT id AS "postId" FROM "Post" WHERE ${Prisma.join(metaConditions, " AND ")}`
    : null;

  // Build the full post subquery
  let postSubquery: Prisma.Sql;
  if (intersectParts.length > 0 && exceptParts.length > 0) {
    const intersectQuery = Prisma.join(intersectParts, " INTERSECT ");
    let combined = Prisma.sql`(${intersectQuery}) EXCEPT (${exceptParts[0]})`;
    // If we have meta tags, intersect with meta-filtered posts
    if (metaTagFilter) {
      combined = Prisma.sql`(${combined}) INTERSECT (${metaTagFilter})`;
    }
    postSubquery = combined;
  } else if (intersectParts.length > 0) {
    let combined = Prisma.join(intersectParts, " INTERSECT ");
    if (metaTagFilter) {
      combined = Prisma.sql`(${combined}) INTERSECT (${metaTagFilter})`;
    }
    postSubquery = combined;
  } else if (exceptParts.length > 0) {
    // Only exclude tags - get all posts except those with excluded tags
    let combined = Prisma.sql`SELECT DISTINCT "postId" FROM "PostTag" EXCEPT (${exceptParts[0]})`;
    if (metaTagFilter) {
      combined = Prisma.sql`(${combined}) INTERSECT (${metaTagFilter})`;
    }
    postSubquery = combined;
  } else if (metaTagFilter) {
    // Only meta tags selected - use meta filter directly
    postSubquery = metaTagFilter;
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
    LIMIT ${limit * 4}  -- Fetch 4x limit to account for blacklist filtering and count > 0 filtering done in-memory
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

  // Add matching meta tags (excluding already selected ones) with co-occurrence counts
  const allSelectedLower = new Set([
    ...selectedTags.map((t) => t.toLowerCase()),
    ...excludeTags.map((t) => t.toLowerCase()),
  ]);
  const matchingMetas = searchMetaTags(query)
    .filter((def) => !allSelectedLower.has(def.name.toLowerCase()));

  // Get the filtered post IDs for co-occurrence counting
  const filteredPostIdsResult = await prisma.$queryRaw<{ postId: number }[]>`
    ${postSubquery}
  `;
  const filteredPostIds = filteredPostIdsResult.map((r) => r.postId);
  const filteredTotal = filteredPostIds.length;

  // Get meta tag counts within the filtered posts (respects co-occurrence)
  const metaTagCounts = matchingMetas.length > 0 && filteredPostIds.length > 0
    ? await getMetaTagCounts(matchingMetas.map((def) => def.name), prisma, filteredPostIds)
    : new Map<string, number>();

  const matchingMetaTags = matchingMetas.map((def, index) => ({
    id: -(index + 1),
    name: def.name,
    category: "META" as const,
    count: metaTagCounts.get(def.name) ?? 0,
    remainingCount: Math.max(0, filteredTotal - (metaTagCounts.get(def.name) ?? 0)),
    isMeta: true,
    description: def.description,
  }));

  return NextResponse.json({
    tags: [...filteredTags, ...matchingMetaTags],
  });
}