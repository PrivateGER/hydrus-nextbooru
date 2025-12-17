"use client";

import { PostCard } from "@/components/post-card";

interface Post {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

interface RandomHighlightsProps {
  posts: Post[];
}

export function RandomHighlights({ posts }: RandomHighlightsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Random Posts</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8">
        {posts.slice(0, 8).map((post) => (
          <PostCard
            key={post.hash}
            hash={post.hash}
            width={post.width}
            height={post.height}
            blurhash={post.blurhash}
            mimeType={post.mimeType}
            layout="grid"
          />
        ))}
      </div>
    </div>
  );
}
