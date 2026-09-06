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
  const positionClass =
    size === "compact"
      ? "right-0 top-0 h-11 w-11 not-any-pointer-coarse:pointer-fine:right-0.5 not-any-pointer-coarse:pointer-fine:top-0.5 not-any-pointer-coarse:pointer-fine:h-5 not-any-pointer-coarse:pointer-fine:w-5"
      : "right-0 top-0 h-11 w-11 not-any-pointer-coarse:pointer-fine:right-2 not-any-pointer-coarse:pointer-fine:top-2 not-any-pointer-coarse:pointer-fine:h-7 not-any-pointer-coarse:pointer-fine:w-7";
  const backingClass =
    size === "compact"
      ? "h-8 w-8 not-any-pointer-coarse:pointer-fine:h-5 not-any-pointer-coarse:pointer-fine:w-5"
      : "h-8 w-8 not-any-pointer-coarse:pointer-fine:h-7 not-any-pointer-coarse:pointer-fine:w-7";
  const iconClass =
    size === "compact"
      ? "h-5 w-5 not-any-pointer-coarse:pointer-fine:h-3 not-any-pointer-coarse:pointer-fine:w-3"
      : "h-5 w-5 not-any-pointer-coarse:pointer-fine:h-4 not-any-pointer-coarse:pointer-fine:w-4";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`group/favorite absolute z-20 inline-flex items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-70 ${positionClass} ${
        favorited
          ? "text-pink-400 opacity-100"
          : "text-white opacity-60 not-any-pointer-coarse:pointer-fine:opacity-100"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute rounded-full bg-black/60 transition-colors group-hover/favorite:bg-black/80 ${backingClass}`}
      />
      {favorited ? (
        <HeartSolidIcon className={`relative ${iconClass}`} />
      ) : (
        <HeartIcon className={`relative ${iconClass}`} />
      )}
    </button>
  );
}
