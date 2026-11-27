"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Window event broadcast whenever a favorite toggle changes a post's state
 * (optimistic flip and rollback alike), so every mounted view of the same
 * post stays in sync — e.g. the post page's Favorite button and that post's
 * badge in the group filmstrip below it.
 */
const FAVORITE_CHANGED_EVENT = "nextbooru:favorite-changed";

interface FavoriteChangedDetail {
  hash: string;
  favorited: boolean;
}

function broadcastFavoriteChange(hash: string, favorited: boolean) {
  window.dispatchEvent(
    new CustomEvent<FavoriteChangedDetail>(FAVORITE_CHANGED_EVENT, { detail: { hash, favorited } }),
  );
}

/**
 * Read-only favorite state for a post that follows toggles made anywhere else
 * on the page.
 *
 * - Starts from the server-rendered `initialFavorited`.
 * - Resyncs to `initialFavorited` when the prop changes without a remount
 *   (e.g. client-side pagination reuses the component) by adjusting state
 *   during render (https://react.dev/learn/you-might-not-need-an-effect).
 * - Follows {@link FAVORITE_CHANGED_EVENT} broadcasts for the same hash.
 *
 * @param hash - post hash whose state is tracked
 * @param initialFavorited - server-rendered favorite state
 */
export function useFavoriteState(hash: string, initialFavorited: boolean) {
  const [favorited, setFavorited] = useState(initialFavorited);

  // Prop can change without remount (e.g. client-side pagination) — resync.
  const [prevInitialFavorited, setPrevInitialFavorited] = useState(initialFavorited);
  if (prevInitialFavorited !== initialFavorited) {
    setPrevInitialFavorited(initialFavorited);
    setFavorited(initialFavorited);
  }

  useEffect(() => {
    const onChange = (event: Event) => {
      const { detail } = event as CustomEvent<FavoriteChangedDetail>;
      if (detail.hash === hash) setFavorited(detail.favorited);
    };
    window.addEventListener(FAVORITE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FAVORITE_CHANGED_EVENT, onChange);
  }, [hash]);

  return favorited;
}

/**
 * Optimistic favorite toggle shared by the standalone FavoriteButton and the
 * PostCard heart overlay. Builds on {@link useFavoriteState}, so state is
 * shared with every other view of the same post on the page.
 *
 * - Optimistically flips state, then PUT/DELETEs `/api/posts/{hash}/favorite`.
 * - Rolls back on a non-ok response or a thrown error.
 * - Ignores clicks while a request is in flight (`pending`).
 * - Stops event propagation/default so it is safe inside a <Link>/<summary>.
 * - Guards every post-await setState behind a mounted ref so a fetch that
 *   resolves after unmount cannot update state.
 *
 * @param hash - post hash the toggle acts on
 * @param initialFavorited - server-rendered favorite state
 */
export function useFavoriteToggle(hash: string, initialFavorited: boolean) {
  const favorited = useFavoriteState(hash, initialFavorited);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const next = !favorited;
    broadcastFavoriteChange(hash, next);
    setPending(true);
    try {
      const response = await fetch(`/api/posts/${hash}/favorite`, {
        method: next ? "PUT" : "DELETE",
      });
      // Roll back even after unmount: other views of the post are still
      // showing the optimistic state.
      if (!response.ok) broadcastFavoriteChange(hash, !next);
    } catch {
      broadcastFavoriteChange(hash, !next);
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

  return { favorited, pending, toggle };
}
