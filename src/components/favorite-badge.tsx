"use client";

import { HeartIcon } from "@heroicons/react/24/solid";
import { useFavoriteState } from "@/hooks/use-favorite-toggle";

interface FavoriteBadgeProps {
  hash: string;
  favorited: boolean;
  className?: string;
}

/**
 * Compact, read-only favorited marker for thumbnails too small for the
 * PostCard heart button (filmstrips). Renders nothing for unfavorited posts
 * and matches the PostCard's favorited look (pink heart on a dark disc), so
 * a favorite reads the same everywhere. Follows toggles made elsewhere on the
 * page, e.g. the post page's Favorite button.
 */
export function FavoriteBadge({ hash, favorited: initialFavorited, className = "" }: FavoriteBadgeProps) {
  const favorited = useFavoriteState(hash, initialFavorited);
  if (!favorited) return null;

  return (
    <span
      role="img"
      aria-label="Favorited"
      title="Favorited"
      className={`pointer-events-none absolute rounded-full bg-black/60 p-1 text-pink-400 ${className}`}
    >
      <HeartIcon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}
