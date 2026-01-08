"use client";

import { useEffect, useState } from "react";
import { PostCard, LayoutMode } from "./post-card";

interface Post {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

interface PostGridProps {
  posts: Post[];
}

const LAYOUT_STORAGE_KEY = "booru-layout-mode";

export function PostGrid({ posts }: PostGridProps) {
  const [layout, setLayout] = useState<LayoutMode>("masonry");

  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved === "grid" || saved === "masonry") {
      setLayout(saved);
    }
  }, []);

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setLayout(newLayout);
    localStorage.setItem(LAYOUT_STORAGE_KEY, newLayout);
  };

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 dark:text-zinc-400">
        <svg
          className="mb-4 h-16 w-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-lg font-medium">No posts found</p>
        <p className="mt-1 text-sm">Try adjusting your search or sync some files from Hydrus</p>
      </div>
    );
  }

  return (
    <div>
      {/* Layout toggle */}
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg bg-zinc-200 dark:bg-zinc-800 p-1">
          <button
            onClick={() => handleLayoutChange("masonry")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              layout === "masonry"
                ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
            title="Masonry layout"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V3zm0 7a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zm-10 1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
            </svg>
          </button>
          <button
            onClick={() => handleLayoutChange("grid")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              layout === "grid"
                ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
            title="Grid layout"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm6 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V3zm6 0a1 1 0 011-1h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a1 1 0 01-1-1V3zM3 9a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm6 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V9zm6 0a1 1 0 011-1h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a1 1 0 01-1-1V9zM3 15a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm6 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3zm6 0a1 1 0 011-1h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a1 1 0 01-1-1v-3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Posts */}
      <div
        className={
          layout === "masonry"
            ? "columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        }
      >
        {posts.map((post) => (
          <PostCard
            key={post.hash}
            hash={post.hash}
            width={post.width}
            height={post.height}
            blurhash={post.blurhash}
            mimeType={post.mimeType}
            layout={layout}
          />
        ))}
      </div>
    </div>
  );
}
