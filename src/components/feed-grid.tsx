"use client";

import { useState } from "react";
import { PostGrid } from "@/components/post-grid";
import type { FeedPost } from "@/lib/feed";

interface FeedGridProps {
  posts: FeedPost[];
}

/**
 * Feed grid with optimistic "not interested" removal. PostCard sends the
 * dismissal request; this component only prunes the local list.
 */
export function FeedGrid({ posts }: FeedGridProps) {
  const [visible, setVisible] = useState(posts);

  const handleDismiss = (hash: string) => {
    setVisible((current) => current.filter((post) => post.hash !== hash));
  };

  return (
    <PostGrid
      posts={visible.map((post) => ({ ...post, favorited: false }))}
      onDismiss={handleDismiss}
    />
  );
}
