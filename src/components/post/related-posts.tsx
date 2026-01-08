import { SparklesIcon } from "@heroicons/react/24/outline";
import { getOrComputeRecommendationsByHash } from "@/lib/recommendations";
import { RelatedPostsClient } from "./related-posts-client";

interface RelatedPostsProps {
  hash: string;
  limit?: number;
}

/**
 * Server component that fetches and displays recommended posts.
 * Uses RelatedPostsClient for the enhanced UI rendering.
 */
export async function RelatedPosts({ hash, limit = 10 }: RelatedPostsProps) {
  const recommendations = await getOrComputeRecommendationsByHash(hash, limit);

  if (recommendations.length === 0) {
    return null;
  }

  return <RelatedPostsClient recommendations={recommendations} />;
}

/**
 * Loading skeleton for RelatedPosts.
 * Use with Suspense to avoid blocking page render.
 */
export function RelatedPostsSkeleton() {
  return (
    <div className="rounded-lg bg-zinc-200 dark:bg-zinc-800 p-4 animate-pulse">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-600" />
        <div className="h-5 w-28 rounded bg-zinc-300 dark:bg-zinc-700" />
        <div className="h-4 w-16 rounded bg-zinc-300 dark:bg-zinc-700" />
      </div>

      {/* Skeleton thumbnails */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-36 w-24 shrink-0 rounded-lg bg-zinc-300 dark:bg-zinc-700"
          />
        ))}
      </div>
    </div>
  );
}
