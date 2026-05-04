import { SparklesIcon } from "@heroicons/react/24/outline";
import { getOrComputeRecommendationsByHash } from "@/lib/recommendations";
import { getEmbeddingOpenRouterSettings, toEmbeddingConfig } from "@/lib/embeddings/settings";
import {
  DEFAULT_EMBEDDING_MIN_SCORE,
  findRelatedPostsByEmbedding,
  type EmbeddedRelatedPost,
} from "@/lib/embeddings/store";
import { RelatedPostsClient } from "./related-posts-client";

interface RelatedPostsProps {
  hash: string;
  limit?: number;
}

async function getSemanticRelatedPosts(hash: string, limit: number): Promise<EmbeddedRelatedPost[]> {
  try {
    const settings = await getEmbeddingOpenRouterSettings();
    return findRelatedPostsByEmbedding({
      hash,
      limit,
      minScore: DEFAULT_EMBEDDING_MIN_SCORE,
      config: toEmbeddingConfig(settings),
    });
  } catch (error) {
    console.error("Failed to load semantically related posts:", error);
    return [];
  }
}

/**
 * Server component that fetches and displays recommended posts.
 * Uses RelatedPostsClient for the enhanced UI rendering.
 */
export async function RelatedPosts({ hash, limit = 10 }: RelatedPostsProps) {
  const [recommendations, semanticPosts] = await Promise.all([
    getOrComputeRecommendationsByHash(hash, limit),
    getSemanticRelatedPosts(hash, limit),
  ]);

  if (recommendations.length === 0 && semanticPosts.length === 0) {
    return null;
  }

  return <RelatedPostsClient recommendations={recommendations} semanticPosts={semanticPosts} />;
}

/**
 * Loading skeleton for RelatedPosts.
 * Use with Suspense to avoid blocking page render.
 */
export function RelatedPostsSkeleton() {
  return (
    <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-4 animate-pulse">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-400" />
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
