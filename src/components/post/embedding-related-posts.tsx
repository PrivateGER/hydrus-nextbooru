import { CircleStackIcon } from "@heroicons/react/24/outline";
import { getEmbeddingOpenRouterSettings } from "@/lib/embeddings/settings";
import { findRelatedPostsByEmbedding } from "@/lib/embeddings/store";
import { EmbeddingRelatedPostsClient } from "@/components/post/embedding-related-posts-client";

interface EmbeddingRelatedPostsProps {
  hash: string;
  limit?: number;
}

export async function EmbeddingRelatedPosts({ hash, limit = 10 }: EmbeddingRelatedPostsProps) {
  const settings = await getEmbeddingOpenRouterSettings();
  const posts = await findRelatedPostsByEmbedding({
    hash,
    limit,
    config: {
      model: settings.model,
      dimensions: settings.dimensions,
      imageMaxResolution: settings.imageMaxResolution,
    },
  });

  if (posts.length === 0) {
    return null;
  }

  return <EmbeddingRelatedPostsClient posts={posts} />;
}

export function EmbeddingRelatedPostsSkeleton() {
  return (
    <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-4 animate-pulse">
      <div className="mb-3 flex items-center gap-2">
        <CircleStackIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-400" />
        <div className="h-5 w-32 rounded bg-zinc-300 dark:bg-zinc-700" />
        <div className="h-4 w-16 rounded bg-zinc-300 dark:bg-zinc-700" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 w-24 shrink-0 rounded-lg bg-zinc-300 dark:bg-zinc-700"
          />
        ))}
      </div>
    </div>
  );
}
