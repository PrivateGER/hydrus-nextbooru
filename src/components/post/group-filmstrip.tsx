"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ThumbnailCard } from "../thumbnail-card";
import { Filmstrip } from "../filmstrip";

interface GroupPost {
  post: {
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
  };
  position: number | null;
}

interface GroupFilmstripProps {
  posts: GroupPost[];
  currentHash: string;
  /** Height class for thumbnails (default: h-32) */
  heightClass?: string;
}

/**
 * Client component for group filmstrip with scroll indicators.
 * Automatically scrolls to the current post on mount.
 */
export function GroupFilmstrip({
  posts,
  currentHash,
  heightClass = "h-32"
}: GroupFilmstripProps) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Auto-scroll to current item on mount
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentHash]);

  const currentIndex = posts.findIndex(pg => pg.post.hash === currentHash);
  const totalPosts = posts.length;

  return (
    <div className="space-y-2">
      {/* Position counter */}
      {currentIndex !== -1 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">
            {currentIndex + 1} / {totalPosts}
          </span>
          <span className="text-zinc-500">in group</span>
        </div>
      )}

      <Filmstrip scrollAmount={200}>
        {posts.map((pg) => {
          const isCurrent = pg.post.hash === currentHash;
          return (
            <Link
              key={pg.post.hash}
              ref={isCurrent ? currentRef : null}
              href={`/post/${pg.post.hash}`}
              className={`relative shrink-0 rounded-lg bg-zinc-700 snap-start transition-all duration-200 ${
                isCurrent
                  ? "ring-2 ring-blue-500 scale-[1.02]"
                  : "hover:ring-2 hover:ring-blue-400 hover:scale-[1.02] opacity-80 hover:opacity-100"
              }`}
            >
              <ThumbnailCard
                hash={pg.post.hash}
                width={pg.post.width}
                height={pg.post.height}
                blurhash={pg.post.blurhash}
                mimeType={pg.post.mimeType}
                heightClass={heightClass}
                showMediaBadge={true}
                className="rounded-lg"
              >
                {/* Position badge */}
                <span className={`absolute bottom-1.5 right-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  isCurrent
                    ? "bg-blue-500 text-white"
                    : "bg-black/70 text-white"
                }`}>
                  {pg.position ?? "?"}
                </span>
              </ThumbnailCard>
            </Link>
          );
        })}
      </Filmstrip>
    </div>
  );
}
