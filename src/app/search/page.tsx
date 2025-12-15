import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { wildcardPatternCache, WildcardCacheEntry } from "@/lib/cache";
import {
  isWildcardPattern,
  wildcardToSqlPattern,
  validateWildcardPattern,
  WILDCARD_TAG_LIMIT,
  ResolvedWildcard,
} from "@/lib/wildcard";
import { wildcardLog } from "@/lib/logger";

const POSTS_PER_PAGE = 48;

interface SearchPageProps {
  searchParams: Promise<{ tags?: string; page?: string }>;
}

/**
 * Split tag strings into included and excluded lists.
 *
 * Tags that start with `-` and have more than one character are placed in `excludeTags`
 * with the leading `-` removed; all other tags are placed in `includeTags`.
 *
 * @param tags - Array of tag strings to parse
 * @returns An object containing `includeTags` and `excludeTags` arrays
 */
function parseTagsWithNegation(tags: string[]): {
  includeTags: string[];
  excludeTags: string[];
} {
  const includeTags: string[] = [];
  const excludeTags: string[] = [];

  for (const tag of tags) {
    if (tag.startsWith("-") && tag.length > 1) {
      excludeTags.push(tag.slice(1));
    } else {
      includeTags.push(tag);
    }
  }

  return { includeTags, excludeTags };
}

/**
 * Resolve a wildcard pattern to matching tags.
 * Results are cached for 5 minutes.
 */
async function resolveWildcardPattern(pattern: string): Promise<WildcardCacheEntry> {
  const cached = wildcardPatternCache.get(pattern);
  if (cached) {
    wildcardLog.debug({ pattern, count: cached.tagNames.length, source: "page" }, "Cache HIT");
    return cached;
  }

  // Convert to SQL LIKE pattern and use raw SQL for accurate wildcard matching
  const sqlPattern = wildcardToSqlPattern(pattern);
  wildcardLog.debug({ pattern, sqlPattern, source: "page" }, "Cache MISS, querying");

  const matchingTags = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
    SELECT id, name FROM "Tag"
    WHERE name ILIKE ${sqlPattern}
    ORDER BY "postCount" DESC
    LIMIT ${WILDCARD_TAG_LIMIT + 1}
  `;

  wildcardLog.debug(
    { pattern, count: matchingTags.length, sample: matchingTags.slice(0, 10).map(t => t.name), source: "page" },
    "Resolved wildcard"
  );

  const truncated = matchingTags.length > WILDCARD_TAG_LIMIT;
  const result: WildcardCacheEntry = {
    tagIds: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.id),
    tagNames: matchingTags.slice(0, WILDCARD_TAG_LIMIT).map((t) => t.name),
    truncated,
  };

  wildcardPatternCache.set(pattern, result);
  return result;
}

/**
 * Search posts by included and excluded tags and return a single paginated result page.
 *
 * Supports wildcard patterns using `*` (e.g., `character:*`, `*_eyes`).
 */
async function searchPosts(tags: string[], page: number) {
  const skip = (page - 1) * POSTS_PER_PAGE;

  const { includeTags, excludeTags } = parseTagsWithNegation(tags);

  if (includeTags.length === 0 && excludeTags.length === 0) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [] };
  }

  // Separate wildcards from regular tags
  const regularIncludeTags: string[] = [];
  const wildcardIncludePatterns: string[] = [];
  const regularExcludeTags: string[] = [];
  const wildcardExcludePatterns: string[] = [];
  const validationErrors: string[] = [];

  for (const tag of includeTags) {
    if (isWildcardPattern(tag)) {
      const validation = validateWildcardPattern(tag);
      if (!validation.valid) {
        validationErrors.push(validation.error!);
      } else {
        wildcardIncludePatterns.push(tag);
      }
    } else {
      regularIncludeTags.push(tag);
    }
  }

  for (const tag of excludeTags) {
    if (isWildcardPattern(tag)) {
      const validation = validateWildcardPattern(`-${tag}`);
      if (!validation.valid) {
        validationErrors.push(validation.error!);
      } else {
        wildcardExcludePatterns.push(tag);
      }
    } else {
      regularExcludeTags.push(tag);
    }
  }

  if (validationErrors.length > 0) {
    return {
      posts: [],
      totalPages: 0,
      totalCount: 0,
      queryTimeMs: 0,
      resolvedWildcards: [],
      error: validationErrors[0],
    };
  }

  // Resolve wildcards to tag IDs
  const resolvedWildcards: ResolvedWildcard[] = [];
  const includeWildcardTagIds: number[][] = [];
  const excludeWildcardTagIds: number[] = [];

  for (const pattern of wildcardIncludePatterns) {
    const resolved = await resolveWildcardPattern(pattern);
    includeWildcardTagIds.push(resolved.tagIds);
    resolvedWildcards.push({
      pattern,
      negated: false,
      tagIds: resolved.tagIds,
      tagNames: resolved.tagNames,
      truncated: resolved.truncated,
    });
  }

  for (const pattern of wildcardExcludePatterns) {
    const resolved = await resolveWildcardPattern(pattern);
    excludeWildcardTagIds.push(...resolved.tagIds);
    resolvedWildcards.push({
      pattern: `-${pattern}`,
      negated: true,
      tagIds: resolved.tagIds,
      tagNames: resolved.tagNames,
      truncated: resolved.truncated,
    });
  }

  // Build where clause
  const andConditions: object[] = [];

  // Regular include tags
  for (const tagName of regularIncludeTags) {
    andConditions.push({
      tags: {
        some: {
          tag: { name: { equals: tagName, mode: "insensitive" as const } },
        },
      },
    });
  }

  // Wildcard include tags
  for (const tagIds of includeWildcardTagIds) {
    if (tagIds.length === 0) {
      return {
        posts: [],
        totalPages: 0,
        totalCount: 0,
        queryTimeMs: 0,
        resolvedWildcards,
      };
    }
    andConditions.push({
      tags: { some: { tagId: { in: tagIds } } },
    });
  }

  // Regular exclude tags
  for (const tagName of regularExcludeTags) {
    andConditions.push({
      tags: {
        none: {
          tag: { name: { equals: tagName, mode: "insensitive" as const } },
        },
      },
    });
  }

  // Wildcard exclude tags
  if (excludeWildcardTagIds.length > 0) {
    andConditions.push({
      tags: { none: { tagId: { in: excludeWildcardTagIds } } },
    });
  }

  const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

  const startTime = performance.now();
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      orderBy: { importedAt: "desc" },
      skip,
      take: POSTS_PER_PAGE,
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
  const queryTimeMs = performance.now() - startTime;

  return {
    posts,
    totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
    totalCount,
    queryTimeMs,
    resolvedWildcards,
  };
}

/**
 * Renders the search page, performing a tag-based query and displaying results with pagination.
 *
 * @param searchParams - A promise resolving to an object with optional `tags` (comma-separated string; individual tags may be negated with a leading `-`) and optional `page` (page number as a string). The component normalizes these values, performs the search, and uses them to render the UI.
 * @returns The search results page element containing the search bar, results header (including tag badges and query timing), conditional empty/no-results messages, a posts grid, and pagination when applicable.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const tagsParam = params.tags || "";
  const tags = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { posts, totalPages, totalCount, queryTimeMs, resolvedWildcards, error } = await searchPosts(tags, page);

  // Build a map of wildcard patterns to their resolved info for display
  const wildcardMap = new Map(
    resolvedWildcards.map((w) => [w.pattern, w])
  );

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex justify-center">
        <SearchBar initialTags={tags} />
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-900/50 border border-red-700 p-4 text-center">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {tags.length > 0 ? (
            <>
              Search:{" "}
              <span className="inline-flex flex-wrap items-center gap-1">
                {tags.map((tag, i) => {
                  const isNegated = tag.startsWith("-") && tag.length > 1;
                  const baseTag = isNegated ? tag.slice(1) : tag;
                  const displayName = baseTag;
                  const isWildcard = baseTag.includes("*");
                  const wildcardInfo = wildcardMap.get(tag);

                  return (
                    <span key={tag} className="group relative">
                      {i > 0 && <span className="text-zinc-500 mx-1">{isNegated ? "-" : "+"}</span>}
                      <span
                        className={
                          isNegated
                            ? "text-red-400 line-through"
                            : isWildcard
                            ? "text-purple-400"
                            : "text-blue-400"
                        }
                        title={
                          wildcardInfo
                            ? `Matches ${wildcardInfo.tagIds.length} tags${wildcardInfo.truncated ? " (truncated)" : ""}: ${wildcardInfo.tagNames.slice(0, 5).join(", ")}${wildcardInfo.tagNames.length > 5 ? "..." : ""}`
                            : undefined
                        }
                      >
                        {displayName}
                        {wildcardInfo && (
                          <span className="text-zinc-500 text-sm ml-1">
                            ({wildcardInfo.tagIds.length}{wildcardInfo.truncated ? "+" : ""})
                          </span>
                        )}
                      </span>
                    </span>
                  );
                })}
              </span>
            </>
          ) : (
            "Search"
          )}
        </h1>
        <span className="text-sm text-zinc-400">
          {totalCount.toLocaleString()} {totalCount === 1 ? "result" : "results"}
          {tags.length > 0 && (
            <span className="ml-2 text-zinc-500">
              ({queryTimeMs < 1000 ? `${Math.round(queryTimeMs)}ms` : `${(queryTimeMs / 1000).toFixed(2)}s`})
            </span>
          )}
        </span>
      </div>

      {/* No results message */}
      {tags.length > 0 && posts.length === 0 && !error && (
        <div className="rounded-lg bg-zinc-800 p-8 text-center">
          <p className="text-lg text-zinc-400">No posts found matching all tags</p>
          <p className="mt-2 text-sm text-zinc-500">
            Try removing some tags or using different search terms
          </p>
        </div>
      )}

      {/* Empty search state */}
      {tags.length === 0 && (
        <div className="rounded-lg bg-zinc-800 p-8 text-center">
          <p className="text-lg text-zinc-400">Enter tags to search</p>
          <p className="mt-2 text-sm text-zinc-500">
            Add multiple tags to find posts matching all of them
          </p>
        </div>
      )}

      {/* Posts grid */}
      {posts.length > 0 && (
        <Suspense
          fallback={
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-zinc-800"
                  style={{ aspectRatio: [1, 0.75, 1.33, 0.8, 1.2][i % 5] }}
                />
              ))}
            </div>
          }
        >
          <PostGrid posts={posts} />
        </Suspense>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} basePath="/search" />
        </Suspense>
      )}
    </div>
  );
}