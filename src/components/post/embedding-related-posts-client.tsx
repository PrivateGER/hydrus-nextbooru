"use client";

import Link from "next/link";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import { Filmstrip } from "@/components/filmstrip";
import { ThumbnailCard } from "@/components/thumbnail-card";
import type { EmbeddedRelatedPost } from "@/lib/embeddings/store";

interface EmbeddingRelatedPostsClientProps {
  posts: EmbeddedRelatedPost[];
}

export function EmbeddingRelatedPostsClient({ posts }: EmbeddingRelatedPostsClientProps) {
  if (posts.length === 0) return null;

  return (
    <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <CircleStackIcon className="h-5 w-5 text-purple-400" />
        <h2 className="text-lg font-semibold">Semantically Related</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {posts.length} {posts.length === 1 ? "image" : "images"}
        </span>
      </div>

      <Filmstrip>
        {posts.map((post) => (
          <Link
            key={post.hash}
            href={`/post/${post.hash}`}
            className="shrink-0 rounded-lg bg-zinc-300 dark:bg-zinc-700 shadow-md snap-start transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 hover:shadow-lg"
            title={`Cosine distance ${post.distance.toFixed(3)}`}
          >
            <ThumbnailCard
              hash={post.hash}
              width={post.width}
              height={post.height}
              blurhash={post.blurhash}
              mimeType={post.mimeType}
              heightClass="h-36"
              className="rounded-lg"
            />
          </Link>
        ))}
      </Filmstrip>
    </div>
  );
}
