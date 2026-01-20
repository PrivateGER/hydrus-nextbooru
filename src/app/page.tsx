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
import { SearchBarSkeleton, PostGridSkeleton, Skeleton } from "@/components/skeletons";
import {
  getHomeStats,
  getPopularTags,
  getRandomPosts,
  getRecentImportCount,
} from "@/lib/stats";
import { withPostHidingFilter, getPostHidingSqlCondition } from "@/lib/tag-blacklist";
import { POSTS_PER_PAGE } from "@/lib/pagination";

type SortOption = "newest" | "oldest" | "random";

interface HomePageProps {
  searchParams: Promise<{ page?: string; sort?: string; seed?: string }>;
}

function HomePageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading gallery">
      <SearchBarSkeleton />
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <PostGridSkeleton />
      </div>
    </div>
  );
}

async function getPosts(page: number, sort: SortOption, seed: string) {
  const skip = (page - 1) * POSTS_PER_PAGE;
  const postHidingCondition = getPostHidingSqlCondition();

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
      WHERE ${postHidingCondition}
      ORDER BY MD5(hash || ${seed})
      LIMIT ${POSTS_PER_PAGE}
      OFFSET ${skip}
    `;

    const totalCount = await prisma.post.count({ where: withPostHidingFilter() });

    return {
      posts,
      totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
      totalCount,
    };
  }

  // Standard sorting
  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "oldest" ? { importedAt: "asc" } : { importedAt: "desc" };

  const whereClause = withPostHidingFilter();

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
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
    prisma.post.count({ where: whereClause }),
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

async function HomePageContent({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string; seed?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const validSorts: SortOption[] = ["newest", "oldest", "random"];
  const sort: SortOption = validSorts.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "newest";
  const seed = params.seed || "";

  // Validate seed format (alphanumeric, 8 chars)
  const isValidSeed = /^[a-z0-9]{8}$/.test(seed);

  // Redirect to include seed for stable random ordering across pagination
  if (sort === "random" && !seed) {
    const newSeed = Math.random().toString(36).substring(2, 10);
    redirect(`/?sort=random&seed=${newSeed}`);
  }

  // Redirect if seed is invalid for random sort
  if (sort === "random" && seed && !isValidSeed) {
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
            <StatsCards
              stats={homeData.stats}
              recentImports={homeData.recentImports}
            />
          </div>

          {/* Popular Tags - Hidden on mobile */}
          <div className="hidden md:block">
            <PopularTags tags={homeData.popularTags} />
          </div>

          {/* Random Highlights */}
          <RandomHighlights posts={homeData.randomPosts} />
        </>
      )}

      {/* Gallery Section */}
      <div className="space-y-6">
        {/* Header with sort options */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {isFirstPage ? "Browse Gallery" : "Gallery"}
          </h2>

          <div className="flex items-center gap-3">
            {/* Sort buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Sort:</span>
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
                        : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
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
                  className="rounded bg-zinc-200 px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-300 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="Shuffle again"
                >
                  🎲
                </Link>
              )}
            </div>

            {/* Post count */}
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalCount.toLocaleString()} posts
            </span>
          </div>
        </div>

        {/* Top pagination */}
        <Pagination currentPage={page} totalPages={totalPages} />

        {/* Posts grid */}
        <Suspense
          fallback={
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-zinc-200 dark:bg-zinc-800"
                  style={{ aspectRatio: [1, 0.75, 1.33, 0.8, 1.2][i % 5] }}
                />
              ))}
            </div>
          }
        >
          <PostGrid posts={posts} />
        </Suspense>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}

/**
 * Render the gallery home page with search, sorting, stable-random ordering, and paginated post results.
 *
 * @param searchParams - A promise resolving to URL query parameters (e.g., `page`, `sort`, `seed`) used to determine pagination, sort mode, and random seed.
 * @returns The page's React element containing the search bar, optional homepage sections on the first page (stats, popular tags, random highlights), gallery header and sort controls, a grid of posts for the current page, and pagination controls.
 */
export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent searchParams={searchParams} />
    </Suspense>
  );
}