"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Optimistic favorite toggle shared by the standalone FavoriteButton and the
 * PostCard heart overlay.
 *
 * - Optimistically flips state, then PUT/DELETEs `/api/posts/{hash}/favorite`.
 * - Rolls back on a non-ok response or a thrown error.
 * - Ignores clicks while a request is in flight (`pending`).
 * - Stops event propagation/default so it is safe inside a <Link>/<summary>.
 * - Resyncs to `initialFavorited` when the prop changes without a remount
 *   (e.g. client-side pagination reuses the component).
 * - Guards every post-await setState behind a mounted ref so a fetch that
 *   resolves after unmount cannot update state.
 *
 * @param hash - post hash the toggle acts on
 * @param initialFavorited - server-rendered favorite state
 */
export function useFavoriteToggle(hash: string, initialFavorited: boolean) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Prop can change without remount (e.g. client-side pagination) — resync.
  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

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
      if (!response.ok && mountedRef.current) setFavorited(!next);
    } catch {
      if (mountedRef.current) setFavorited(!next);
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

  return { favorited, pending, toggle };
}
