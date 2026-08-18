"use client";

import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";

interface FavoriteOverlayButtonProps {
  hash: string;
  initialFavorited: boolean;
  className?: string;
  size?: "default" | "compact";
}

/** Compact favorite action for thumbnail cards and strips. */
export function FavoriteOverlayButton({
  hash,
  initialFavorited,
  className = "",
  size = "default",
}: FavoriteOverlayButtonProps) {
  const { favorited, pending, toggle } = useFavoriteToggle(hash, initialFavorited);
  const positionClass = size === "compact" ? "right-0.5 top-0.5 p-1" : "right-2 top-2 p-1.5";
  const iconClass = size === "compact" ? "h-3 w-3" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`absolute z-20 rounded-full bg-black/60 transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-70 ${positionClass} ${
        favorited ? "text-pink-400" : "text-white"
      } ${className}`}
    >
      {favorited ? <HeartSolidIcon className={iconClass} /> : <HeartIcon className={iconClass} />}
    </button>
  );
}
