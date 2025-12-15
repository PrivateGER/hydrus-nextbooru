import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isWildcardPattern,
  validateWildcardPattern,
  parseTagsParamWithNegation,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

/**
 * Handle GET requests to search posts filtered by included and excluded tags with pagination.
 *
 * Supports wildcard patterns using `*` (e.g., `character:*`, `*_eyes`).
 *
 * If both include and exclude tag lists are empty, responds with empty results.
 *
 * @returns A JSON object with:
 *   - `posts`: array of matching posts
 *   - `totalCount`: total number of matching posts
 *   - `totalPages`: number of pages
 *   - `resolvedWildcards`: (optional) array of resolved wildcard patterns with matched tags
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  // Parse tags with negation support
  const { includeTags, excludeTags } = parseTagsParamWithNegation(tagsParam);

  if (includeTags.length === 0 && excludeTags.length === 0) {
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

  const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

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