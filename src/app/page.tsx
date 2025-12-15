import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { StatsCards } from "@/components/home/stats-cards";
import { PopularTags } from "@/components/home/popular-tags";
import { RecentPosts } from "@/components/home/recent-posts";
import {
  getHomeStats,
  getPopularTags,
  getRecentPosts,
  getRecentImportCount,
} from "@/lib/stats";

const POSTS_PER_PAGE = 48;

interface HomePageProps {
  searchParams: Promise<{ page?: string }>;
}

async function getPosts(page: number) {
  const skip = (page - 1) * POSTS_PER_PAGE;

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
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
    prisma.post.count(),
  ]);

  return {
    posts,
    totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
    totalCount,
  };
}

async function getHomeData() {
  const [stats, popularTags, recentPosts, recentImports] = await Promise.all([
    getHomeStats(),
    getPopularTags(8),
    getRecentPosts(8),
    getRecentImportCount(),
  ]);

  return { stats, popularTags, recentPosts, recentImports };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const isFirstPage = page === 1;

  // Fetch posts for current page
  const { posts, totalPages, totalCount } = await getPosts(page);

  // Only fetch homepage data on first page
  const homeData = isFirstPage ? await getHomeData() : null;

  return (
    <div className="space-y-8">
      {/* Search Bar - Always visible */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <SearchBar placeholder="Search by tags..." />
        </div>
      </div>

      {/* Homepage sections - Only on first page */}
      {isFirstPage && homeData && (
        <>
          {/* Stats Dashboard */}
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
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

          {/* Popular Tags */}
          <Suspense fallback={null}>
            <PopularTags tags={homeData.popularTags} />
          </Suspense>

          {/* Recent Imports */}
          <Suspense fallback={null}>
            <RecentPosts posts={homeData.recentPosts} />
          </Suspense>
        </>
      )}

      {/* Gallery Section */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-100">
            {isFirstPage ? "Browse Gallery" : "Gallery"}
          </h2>
          <span className="text-sm text-zinc-400">
            {totalCount.toLocaleString()} posts
          </span>
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
            basePath="/"
          />
        </Suspense>
      </div>
    </div>
  );
}
