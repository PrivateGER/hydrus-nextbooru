import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeartIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { getFeedPage } from "@/lib/feed";
import { sanitizePositiveInt, MAX_PAGE } from "@/lib/search";
import { FeedGrid } from "@/components/feed-grid";
import { Pagination } from "@/components/pagination";
import { PostGridSkeleton } from "@/components/skeletons";

export const metadata: Metadata = {
  title: "For You - Booru",
  description: "Posts recommended from your favorites",
};

// Personal, mutable content: rendered per-request. With Cache Components
// enabled, awaiting searchParams below marks this route dynamic (nothing is
// wrapped in "use cache"), so the feed is never statically cached. The
// `export const dynamic` segment config is incompatible with cacheComponents.
const FEED_PAGE_SIZE = 48;

interface RecommendedPageProps {
  searchParams: Promise<{ page?: string }>;
}

async function RecommendedContent({ searchParams }: RecommendedPageProps) {
  const params = await searchParams;
  const page = sanitizePositiveInt(params.page ?? null, 1, MAX_PAGE);

  const { posts, totalCount, totalPages } = await getFeedPage(page, FEED_PAGE_SIZE);

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-500 dark:text-zinc-400">
        <HeartIcon className="h-10 w-10" />
        <p className="text-lg font-medium">Your feed is empty</p>
        <p className="text-sm">
          Favorite some posts and recommendations will show up here.
        </p>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Browse the gallery
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <SparklesIcon className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        <h1 className="text-2xl font-bold">For You</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalCount} recommendation{totalCount === 1 ? "" : "s"}
        </span>
      </header>
      <FeedGrid key={page} posts={posts} />
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}

export default function RecommendedPage({ searchParams }: RecommendedPageProps) {
  return (
    <Suspense fallback={<PostGridSkeleton />}>
      <RecommendedContent searchParams={searchParams} />
    </Suspense>
  );
}
