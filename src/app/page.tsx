import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { StatsCards } from "@/components/home/stats-cards";
import { PopularTags } from "@/components/home/popular-tags";
import { RandomHighlights } from "@/components/home/random-highlights";
import {
  getHomeStats,
  getPopularTags,
  getRandomPosts,
  getRecentImportCount,
} from "@/lib/stats";

const POSTS_PER_PAGE = 48;

type SortOption = "newest" | "oldest" | "random";

interface HomePageProps {
  searchParams: Promise<{ page?: string; sort?: string; seed?: string }>;
}

async function getPosts(page: number, sort: SortOption, seed: string) {
  const skip = (page - 1) * POSTS_PER_PAGE;

  // For random sorting, use raw query with MD5
  if (sort === "random") {
    const posts = await prisma.$queryRaw<
      Array<{
        id: number;
        hash: string;
        width: number | null;
        height: number | null;
        blurhash: string | null;
        mimeType: string;
      }>
    >`
      SELECT id, hash, width, height, blurhash, "mimeType"
      FROM "Post"
      ORDER BY MD5(hash || ${seed})
      LIMIT ${POSTS_PER_PAGE}
      OFFSET ${skip}
    `;

    const totalCount = await prisma.post.count();

    return {
      posts,
      totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
      totalCount,
    };
  }

  // Standard sorting
  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "oldest" ? { importedAt: "asc" } : { importedAt: "desc" };

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      orderBy,
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
    prisma.post.count(),
  ]);

  return {
    posts,
    totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
    totalCount,
  };
}

async function getHomeData() {
  const [stats, popularTags, randomPosts, recentImports] = await Promise.all([
    getHomeStats(),
    getPopularTags(8),
    getRandomPosts(8),
    getRecentImportCount(),
  ]);

  return { stats, popularTags, randomPosts, recentImports };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const sort = (params.sort as SortOption) || "newest";
  const seed = params.seed || "";

  // Redirect to include seed for stable random ordering across pagination
  if (sort === "random" && !seed) {
    const newSeed = Math.random().toString(36).substring(2, 10);
    redirect(`/?sort=random&seed=${newSeed}`);
  }

  const isFirstPage = page === 1 && sort === "newest";

  // Build URL helper
  function buildUrl(overrides: {
    sort?: SortOption;
    page?: number;
    newSeed?: boolean;
  }) {
    const urlParams = new URLSearchParams();
    const newSort = overrides.sort ?? sort;
    const newPage = overrides.page ?? page;
    const newSeed = overrides.newSeed
      ? Math.random().toString(36).substring(2, 10)
      : seed;

    if (newSort !== "newest") urlParams.set("sort", newSort);
    if (newPage > 1) urlParams.set("page", newPage.toString());
    if (newSort === "random") urlParams.set("seed", newSeed);

    const queryString = urlParams.toString();
    return queryString ? `/?${queryString}` : "/";
  }

  // Fetch posts for current page
  const { posts, totalPages, totalCount } = await getPosts(page, sort, seed);

  // Only fetch homepage data on first page with default sort
  const homeData = isFirstPage ? await getHomeData() : null;

  // Build basePath for pagination that preserves sort
  const paginationBasePath = sort === "newest"
    ? "/"
    : sort === "random"
      ? `/?sort=random&seed=${seed}`
      : `/?sort=${sort}`;

  return (
    <div className="space-y-8">
      {/* Search Bar - Always visible */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <SearchBar placeholder="Search by tags..." />
        </div>
      </div>

      {/* Homepage sections - Only on first page with default sort */}
      {isFirstPage && homeData && (
        <>
          {/* Stats Dashboard - Hidden on mobile */}
          <div className="hidden md:block">
            <Suspense
              fallback={
                <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-lg bg-zinc-800"
                    />
                  ))}
                </div>
              }
            >
              <StatsCards
                stats={homeData.stats}
                recentImports={homeData.recentImports}
              />
            </Suspense>
          </div>

          {/* Popular Tags - Hidden on mobile */}
          <div className="hidden md:block">
            <Suspense fallback={null}>
              <PopularTags tags={homeData.popularTags} />
            </Suspense>
          </div>

          {/* Random Highlights */}
          <Suspense fallback={null}>
            <RandomHighlights posts={homeData.randomPosts} />
          </Suspense>
        </>
      )}

      {/* Gallery Section */}
      <div className="space-y-6">
        {/* Header with sort options */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-zinc-100">
            {isFirstPage ? "Browse Gallery" : "Gallery"}
          </h2>

          <div className="flex items-center gap-3">
            {/* Sort buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Sort:</span>
              <div className="flex gap-1">
                {(["newest", "oldest", "random"] as const).map((s) => (
                  <Link
                    key={s}
                    href={buildUrl({
                      sort: s,
                      page: 1,
                      newSeed: s === "random" && sort !== "random",
                    })}
                    className={`rounded px-2 py-1 text-sm capitalize transition-colors ${
                      sort === s
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    {s}
                  </Link>
                ))}
              </div>
              {/* Re-roll button for random */}
              {sort === "random" && (
                <Link
                  href={buildUrl({ page: 1, newSeed: true })}
                  className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
                  title="Shuffle again"
                >
                  🎲
                </Link>
              )}
            </div>

            {/* Post count */}
            <span className="text-sm text-zinc-400">
              {totalCount.toLocaleString()} posts
            </span>
          </div>
        </div>

        {/* Posts grid */}
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

        {/* Pagination */}
        <Suspense fallback={null}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath={paginationBasePath}
          />
        </Suspense>
      </div>
    </div>
  );
}
