import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";

const POSTS_PER_PAGE = 48;

interface SearchPageProps {
  searchParams: Promise<{ tags?: string; page?: string }>;
}

/**
 * Parse tags into included and excluded lists.
 * Tags prefixed with `-` are excluded.
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

async function searchPosts(tags: string[], page: number) {
  const skip = (page - 1) * POSTS_PER_PAGE;

  const { includeTags, excludeTags } = parseTagsWithNegation(tags);

  if (includeTags.length === 0 && excludeTags.length === 0) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0 };
  }

  // Build where clause with AND for included tags and NONE for excluded tags
  const andConditions: object[] = [];

  // Include tags: posts must have ALL specified tags
  for (const tagName of includeTags) {
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

  // Exclude tags: posts must NOT have ANY of the excluded tags
  for (const tagName of excludeTags) {
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
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const tagsParam = params.tags || "";
  const tags = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { posts, totalPages, totalCount, queryTimeMs } = await searchPosts(tags, page);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex justify-center">
        <SearchBar initialTags={tags} />
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {tags.length > 0 ? (
            <>
              Search:{" "}
              <span className="inline-flex flex-wrap items-center gap-1">
                {tags.map((tag, i) => {
                  const isNegated = tag.startsWith("-") && tag.length > 1;
                  const displayName = isNegated ? tag.slice(1) : tag;
                  return (
                    <span key={tag}>
                      {i > 0 && <span className="text-zinc-500 mx-1">{isNegated ? "-" : "+"}</span>}
                      <span
                        className={
                          isNegated
                            ? "text-red-400 line-through"
                            : "text-blue-400"
                        }
                      >
                        {displayName}
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
      {tags.length > 0 && posts.length === 0 && (
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
