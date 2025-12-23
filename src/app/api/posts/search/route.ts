import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  isWildcardPattern,
  validateWildcardPattern,
  parseTagsParamWithNegation,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";
import { isTagBlacklisted, withPostHidingFilter, getPostHidingSqlCondition } from "@/lib/tag-blacklist";
import {
  separateMetaTags,
  getMetaTagDefinition,
  requiresRawSql,
  getOrientationSqlCondition,
} from "@/lib/meta-tags";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000; // Prevent expensive queries with excessive offsets

/**
 * Search posts by included and excluded tags with pagination and support for wildcard patterns.
 * Also supports filtering by note content.
 *
 * Query parameters:
 * - `tags`: comma-separated tag names; prefix with `-` to exclude
 * - `notes`: search query for note content (full-text search)
 * - `notesMode`: "fulltext" (default) or "partial" for ILIKE matching
 * - `page`: page number (default 1)
 * - `limit`: results per page (default 48, max 100)
 *
 * @returns An object containing:
 *   - `posts`: array of matching posts (selected fields: `id`, `hash`, `width`, `height`, `blurhash`, `mimeType`)
 *   - `totalCount`: total number of matching posts
 *   - `totalPages`: number of pages based on the requested `limit`
 *   - `resolvedWildcards` (optional): array of resolved wildcard patterns with matched `tagIds`, `tagNames`, `tagCategories`, and `truncated` flag
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const notesQuery = searchParams.get("notes")?.trim() || "";
  const notesMode = searchParams.get("notesMode") || "fulltext";
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  );
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  // Parse tags with negation support
  const { includeTags: rawIncludeTags, excludeTags: rawExcludeTags } = parseTagsParamWithNegation(tagsParam);

  // Filter out blacklisted tags from input - users should not be able to search using blacklisted tags
  const filteredIncludeTags = rawIncludeTags.filter(tag => !isTagBlacklisted(tag));
  const filteredExcludeTags = rawExcludeTags.filter(tag => !isTagBlacklisted(tag));

  // Separate meta tags from regular tags
  const { metaTags, regularTags } = separateMetaTags([
    ...filteredIncludeTags,
    ...filteredExcludeTags.map(t => `-${t}`),
  ]);

  // Recombine regular tags for processing
  const includeTags = regularTags.include;
  const excludeTags = regularTags.exclude;

  const hasTagFilters = includeTags.length > 0 || excludeTags.length > 0;
  const hasMetaTagFilters = metaTags.include.length > 0 || metaTags.exclude.length > 0;
  const hasNotesFilter = notesQuery.length >= 2;

  if (!hasTagFilters && !hasMetaTagFilters && !hasNotesFilter) {
    return NextResponse.json({
      posts: [],
      totalCount: 0,
      totalPages: 0,
    });
  }

  // Separate wildcards from regular tags
  const regularIncludeTags: string[] = [];
  const wildcardIncludePatterns: string[] = [];
  const regularExcludeTags: string[] = [];
  const wildcardExcludePatterns: string[] = [];

  for (const tag of includeTags) {
    if (isWildcardPattern(tag)) {
      const validation = validateWildcardPattern(tag);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      wildcardExcludePatterns.push(tag);
    } else {
      regularExcludeTags.push(tag);
    }
  }

  // Resolve wildcards to tag IDs
  const resolvedWildcards: ResolvedWildcard[] = [];

  // Resolve include wildcards
  const includeWildcardTagIds: number[][] = [];
  for (const pattern of wildcardIncludePatterns) {
    const resolved = await resolveWildcardPattern(pattern, "posts-api");
    includeWildcardTagIds.push(resolved.tagIds);
    resolvedWildcards.push({
      pattern,
      negated: false,
      tagIds: resolved.tagIds,
      tagNames: resolved.tagNames,
      tagCategories: resolved.tagCategories,
      truncated: resolved.truncated,
    });
  }

  // Resolve exclude wildcards
  const excludeWildcardTagIds: number[] = [];
  for (const pattern of wildcardExcludePatterns) {
    const resolved = await resolveWildcardPattern(pattern, "posts-api");
    excludeWildcardTagIds.push(...resolved.tagIds);
    resolvedWildcards.push({
      pattern: `-${pattern}`,
      negated: true,
      tagIds: resolved.tagIds,
      tagNames: resolved.tagNames,
      tagCategories: resolved.tagCategories,
      truncated: resolved.truncated,
    });
  }

  const skip = (page - 1) * limit;

  // Build where clause with AND for included tags and NONE for excluded tags
  const andConditions: object[] = [];

  // Regular include tags: posts must have ALL specified tags (exact match)
  for (const tagName of regularIncludeTags) {
    andConditions.push({
      tags: {
        some: {
          tag: {
            name: {
              equals: tagName,
              mode: "insensitive" as const,
            },
          },
        },
      },
    });
  }

  // Wildcard include tags: posts must have at least one tag from each wildcard pattern
  for (const tagIds of includeWildcardTagIds) {
    if (tagIds.length === 0) {
      // Wildcard matched no tags, so no posts can match
      return NextResponse.json({
        posts: [],
        totalCount: 0,
        totalPages: 0,
        resolvedWildcards,
      });
    }
    andConditions.push({
      tags: {
        some: {
          tagId: {
            in: tagIds,
          },
        },
      },
    });
  }

  // Regular exclude tags: posts must NOT have ANY of the excluded tags (exact match)
  for (const tagName of regularExcludeTags) {
    andConditions.push({
      tags: {
        none: {
          tag: {
            name: {
              equals: tagName,
              mode: "insensitive" as const,
            },
          },
        },
      },
    });
  }

  // Wildcard exclude tags: posts must NOT have ANY of the matched tags
  if (excludeWildcardTagIds.length > 0) {
    andConditions.push({
      tags: {
        none: {
          tagId: {
            in: excludeWildcardTagIds,
          },
        },
      },
    });
  }

  // Notes filter: use Prisma's relational queries to avoid loading all post IDs into memory
  if (hasNotesFilter) {
    if (notesMode === "partial") {
      // Partial matching using ILIKE with trigram index
      const searchPattern = `%${escapeSqlLike(notesQuery)}%`;
      andConditions.push({
        notes: {
          some: {
            OR: [
              {
                content: {
                  contains: notesQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: notesQuery,
                  mode: "insensitive" as const,
                },
              },
            ],
          },
        },
      });
    } else {
      // Full-text search using tsvector - search both content AND name for consistency
      const matchingNotes = await prisma.$queryRaw<{ postId: number }[]>`
        SELECT DISTINCT "postId"
        FROM "Note"
        WHERE to_tsvector('simple', content) @@ websearch_to_tsquery('simple', ${notesQuery})
           OR to_tsvector('simple', name) @@ websearch_to_tsquery('simple', ${notesQuery})
      `;
      const noteMatchingPostIds = matchingNotes.map((n) => n.postId);

      // If no notes match, return empty results early
      if (noteMatchingPostIds.length === 0) {
        return NextResponse.json({
          posts: [],
          totalCount: 0,
          totalPages: 0,
          ...(resolvedWildcards.length > 0 && { resolvedWildcards }),
        });
      }

      andConditions.push({
        id: {
          in: noteMatchingPostIds,
        },
      });
    }
  }

  // Add meta tag conditions (non-orientation)
  for (const metaName of metaTags.include) {
    if (!requiresRawSql(metaName)) {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        andConditions.push(def.getCondition());
      }
    }
  }

  for (const metaName of metaTags.exclude) {
    if (!requiresRawSql(metaName)) {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        andConditions.push({ NOT: def.getCondition() });
      }
    }
  }

  // Check for orientation meta tags that require raw SQL
  const orientationInclude = metaTags.include.filter(requiresRawSql);
  const orientationExclude = metaTags.exclude.filter(requiresRawSql);
  const hasOrientationTags = orientationInclude.length > 0 || orientationExclude.length > 0;

  // Build orientation SQL conditions
  let orientationSqlCondition: Prisma.Sql | null = null;
  if (hasOrientationTags) {
    const orientationConditions: Prisma.Sql[] = [];

    for (const metaName of orientationInclude) {
      orientationConditions.push(getOrientationSqlCondition(metaName, false));
    }

    for (const metaName of orientationExclude) {
      orientationConditions.push(getOrientationSqlCondition(metaName, true));
    }

    orientationSqlCondition = orientationConditions.length > 1
      ? Prisma.sql`(${Prisma.join(orientationConditions, " AND ")})`
      : orientationConditions[0];
  }

  const baseWhereClause = andConditions.length > 0 ? { AND: andConditions } : {};
  const whereClause = withPostHidingFilter(baseWhereClause);

  // If orientation tags are present, use raw SQL query
  if (orientationSqlCondition) {
    const postHidingCondition = getPostHidingSqlCondition('p.id');
    const hasOtherFilters = andConditions.length > 0;

    if (!hasOtherFilters) {
      // Simple orientation-only query
      const [posts, countResult] = await Promise.all([
        prisma.$queryRaw<{ id: number; hash: string; width: number | null; height: number | null; blurhash: string | null; mimeType: string }[]>`
          SELECT p.id, p.hash, p.width, p.height, p.blurhash, p."mimeType"
          FROM "Post" p
          WHERE ${orientationSqlCondition}
            AND ${postHidingCondition}
          ORDER BY p."importedAt" DESC
          LIMIT ${limit} OFFSET ${skip}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count
          FROM "Post" p
          WHERE ${orientationSqlCondition}
            AND ${postHidingCondition}
        `,
      ]);

      return NextResponse.json({
        posts,
        totalCount: Number(countResult[0]?.count ?? 0),
        totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
        ...(resolvedWildcards.length > 0 && { resolvedWildcards }),
      });
    }

    // Orientation + other filters: get IDs matching orientation, then filter with Prisma
    const MAX_ORIENTATION_IDS = 50000;
    const orientationPosts = await prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id FROM "Post" p
      WHERE ${orientationSqlCondition}
        AND ${postHidingCondition}
      ORDER BY p."importedAt" DESC
      LIMIT ${MAX_ORIENTATION_IDS}
    `;

    if (orientationPosts.length === 0) {
      return NextResponse.json({
        posts: [],
        totalCount: 0,
        totalPages: 0,
        ...(resolvedWildcards.length > 0 && { resolvedWildcards }),
      });
    }

    const orientationPostIds = orientationPosts.map(p => p.id);
    const filteredWhere = withPostHidingFilter({
      AND: [
        { id: { in: orientationPostIds } },
        ...andConditions,
      ],
    });

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where: filteredWhere,
        orderBy: { importedAt: "desc" },
        skip,
        take: limit,
        select: { id: true, hash: true, width: true, height: true, blurhash: true, mimeType: true },
      }),
      prisma.post.count({ where: filteredWhere }),
    ]);

    return NextResponse.json({
      posts,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      ...(resolvedWildcards.length > 0 && { resolvedWildcards }),
    });
  }

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      orderBy: { importedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        hash: true,
        width: true,
        height: true,
        blurhash: true,
        mimeType: true,
      },
    }),
    prisma.post.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    posts,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    ...(resolvedWildcards.length > 0 && { resolvedWildcards }),
  });
}