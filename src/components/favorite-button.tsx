"use client";

import { useState } from "react";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";

interface FavoriteButtonProps {
  hash: string;
  initialFavorited: boolean;
  className?: string;
}

/**
 * Optimistic favorite toggle. Rolls back on request failure.
 * Safe inside <summary>/<Link> parents: stops propagation and default.
 */
export function FavoriteButton({ hash, initialFavorited, className = "" }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const next = !favorited;
    setFavorited(next);
    setPending(true);
    try {
      const response = await fetch(`/api/posts/${hash}/favorite`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!response.ok) setFavorited(!next);
    } catch {
      setFavorited(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        favorited
          ? "bg-pink-600 text-white hover:bg-pink-500"
          : "bg-zinc-300 text-zinc-700 hover:bg-zinc-400 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      } ${className}`}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      {favorited ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
      <span>{favorited ? "Favorited" : "Favorite"}</span>
    </button>
  );
}
