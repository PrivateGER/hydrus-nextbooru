"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ThumbnailCard } from "../thumbnail-card";
import { Filmstrip } from "../filmstrip";
import { buildPostUrl } from "@/lib/post-navigation";

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
  /**
   * Group these posts belong to. Thumbnail links carry it as ?in= so
   * navigation stays pinned to this group after clicking into it.
   */
  groupId?: number;
  /** Whether arrow-key/swipe navigation currently follows this group. */
  isActiveNav?: boolean;
  /**
   * URL of the current post with this group as navigation context. Rendered
   * as a "navigate this group" link when the group is not the active
   * context, so the user can hand the arrows to this group without leaving
   * the image they are on.
   */
  switchNavUrl?: string;
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
  groupId,
  isActiveNav = false,
  switchNavUrl,
  heightClass = "h-32"
}: GroupFilmstripProps) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Auto-scroll to current item on mount (horizontal only, no page scroll)
  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;

    // Find scrollable parent
    let parent = el.parentElement;
    while (parent) {
      const overflow = getComputedStyle(parent).overflowX;
      if (overflow === "auto" || overflow === "scroll") break;
      parent = parent.parentElement;
    }
    if (parent) {
      // Use getBoundingClientRect to get accurate position regardless of offsetParent
      const elRect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const offset = elRect.left - parentRect.left + parent.scrollLeft;
      // Disable smooth scroll temporarily for instant jump
      const prevBehavior = parent.style.scrollBehavior;
      parent.style.scrollBehavior = "auto";
      parent.scrollLeft = Math.max(0, offset - (parent.clientWidth - el.offsetWidth) / 2);
      parent.style.scrollBehavior = prevBehavior;
    }
  }, [currentHash]);

  const currentIndex = posts.findIndex(pg => pg.post.hash === currentHash);
  const totalPosts = posts.length;

  return (
    <div className="space-y-2">
      {/* Position counter */}
      {currentIndex !== -1 && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {currentIndex + 1} / {totalPosts}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">in group</span>
          {isActiveNav ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
              title="Arrow keys and swipes move through this group"
            >
              <ChevronLeftIcon className="h-3 w-3" />
              <ChevronRightIcon className="h-3 w-3" />
              navigating this group
            </span>
          ) : switchNavUrl ? (
            <Link
              href={switchNavUrl}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-700/50 dark:text-zinc-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-400"
              title="Make arrow keys and swipes move through this group"
            >
              <ChevronLeftIcon className="h-3 w-3" />
              <ChevronRightIcon className="h-3 w-3" />
              navigate this group
            </Link>
          ) : null}
        </div>
      )}

      <Filmstrip scrollAmount={200}>
        {posts.map((pg, index) => {
          const isCurrent = pg.post.hash === currentHash;
          return (
            <Link
              key={pg.post.hash}
              ref={isCurrent ? currentRef : null}
              href={buildPostUrl(pg.post.hash, groupId)}
              className={`relative shrink-0 rounded-lg bg-zinc-300 dark:bg-zinc-700 snap-start transition-all duration-200 ${
                isCurrent
                  ? "ring-2 ring-blue-500 scale-[1.02]"
                  : "hover:ring-2 hover:ring-blue-400 hover:scale-[1.02] opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                {/* Ordinal badge (1-based reading order; raw Hydrus positions
                    can be sparse or duplicated, so show the ordinal) */}
                <span className={`absolute bottom-1.5 right-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  isCurrent
                    ? "bg-blue-500 text-white"
                    : "bg-black/70 text-white"
                }`}>
                  {index + 1}
                </span>
              </ThumbnailCard>
            </Link>
          );
        })}
      </Filmstrip>
    </div>
  );
}
