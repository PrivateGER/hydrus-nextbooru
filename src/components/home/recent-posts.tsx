"use client";

import { PostCard } from "@/components/post-card";

interface Post {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

interface RecentPostsProps {
  posts: Post[];
}

export function RecentPosts({ posts }: RecentPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Recent Imports</h2>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
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
