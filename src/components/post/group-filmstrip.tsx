"use client";

import Link from "next/link";
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
}

/**
 * Client component for group filmstrip with scroll indicators.
 */
export function GroupFilmstrip({ posts, currentHash }: GroupFilmstripProps) {
  return (
    <Filmstrip>
      {posts.map((pg) => (
        <Link
          key={pg.post.hash}
          href={`/post/${pg.post.hash}`}
          className={`shrink-0 rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] ${
            pg.post.hash === currentHash
              ? "ring-2 ring-blue-500"
              : "hover:ring-2 hover:ring-blue-500"
          }`}
        >
          <ThumbnailCard
            hash={pg.post.hash}
            width={pg.post.width}
            height={pg.post.height}
            blurhash={pg.post.blurhash}
            mimeType={pg.post.mimeType}
            heightClass="h-24"
            showMediaBadge={false}
            className="rounded-lg"
          >
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {pg.position || "?"}
            </span>
          </ThumbnailCard>
        </Link>
      ))}
    </Filmstrip>
  );
}
