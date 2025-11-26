import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";

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

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { posts, totalPages, totalCount } = await getPosts(page);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gallery</h1>
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
        <Pagination currentPage={page} totalPages={totalPages} basePath="/" />
      </Suspense>
    </div>
  );
}
