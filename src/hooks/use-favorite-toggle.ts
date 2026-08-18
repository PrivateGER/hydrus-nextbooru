"use client";

import { useEffect, useRef, useState } from "react";

const FAVORITE_STATE_CHANGED_EVENT = "nextbooru:favoriteStateChanged";

interface FavoriteStateChangedDetail {
  hash: string;
  favorited: boolean;
}

function broadcastFavoriteState(detail: FavoriteStateChangedDetail) {
  window.dispatchEvent(
    new CustomEvent<FavoriteStateChangedDetail>(FAVORITE_STATE_CHANGED_EVENT, { detail })
  );
}

/**
 * Optimistic favorite toggle shared by the standalone FavoriteButton and the
 * PostCard heart overlay.
 *
 * - Optimistically flips state, then PUT/DELETEs `/api/posts/{hash}/favorite`.
 * - Rolls back on a non-ok response or a thrown error.
 * - Ignores clicks while a request is in flight (`pending`).
 * - Stops event propagation/default so it is safe inside a <Link>/<summary>.
 * - Resyncs to `initialFavorited` when the prop changes without a remount
 *   (e.g. client-side pagination reuses the component) by adjusting state
 *   during render (https://react.dev/learn/you-might-not-need-an-effect).
 * - Broadcasts optimistic updates and rollbacks so duplicate thumbnails for
 *   the same post stay visually synchronized on the current page.
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

  useEffect(() => {
    const syncFavoriteState = (event: Event) => {
      const { detail } = event as CustomEvent<FavoriteStateChangedDetail>;
      if (detail.hash === hash) setFavorited(detail.favorited);
    };

    window.addEventListener(FAVORITE_STATE_CHANGED_EVENT, syncFavoriteState);
    return () => window.removeEventListener(FAVORITE_STATE_CHANGED_EVENT, syncFavoriteState);
  }, [hash]);

  // Prop can change without remount (e.g. client-side pagination) — resync.
  const [prevInitialFavorited, setPrevInitialFavorited] = useState(initialFavorited);
  if (prevInitialFavorited !== initialFavorited) {
    setPrevInitialFavorited(initialFavorited);
    setFavorited(initialFavorited);
  }

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const next = !favorited;
    setFavorited(next);
    broadcastFavoriteState({ hash, favorited: next });
    setPending(true);
    try {
      const response = await fetch(`/api/posts/${hash}/favorite`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!response.ok) {
        if (mountedRef.current) setFavorited(!next);
        broadcastFavoriteState({ hash, favorited: !next });
      }
    } catch {
      if (mountedRef.current) setFavorited(!next);
      broadcastFavoriteState({ hash, favorited: !next });
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

  return { favorited, pending, toggle };
}
