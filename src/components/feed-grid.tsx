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

  // Resync when the caller passes a new page's posts. The page also remounts
  // via key={page}, but relying on that alone would silently drop a prop
  // change if the key ever stopped varying. Adjusted during render instead of
  // in an effect so the old page's posts never paint.
  const [prevPosts, setPrevPosts] = useState(posts);
  if (prevPosts !== posts) {
    setPrevPosts(posts);
    setVisible(posts);
  }

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
