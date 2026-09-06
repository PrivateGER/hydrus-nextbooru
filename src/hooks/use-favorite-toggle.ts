"use client";

import { useEffect, useState } from "react";

const FAVORITE_STATE_CHANGED_EVENT = "nextbooru:favoriteStateChanged";

interface FavoriteStateChangedDetail {
  hash: string;
  favorited: boolean;
  pending: boolean;
}

const latestFavoriteStates = new Map<string, boolean>();
const pendingFavoriteHashes = new Set<string>();

function getLatestFavoriteState(hash: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  return latestFavoriteStates.get(hash) ?? fallback;
}

function broadcastFavoriteState(detail: FavoriteStateChangedDetail) {
  latestFavoriteStates.set(detail.hash, detail.favorited);
  if (detail.pending) pendingFavoriteHashes.add(detail.hash);
  else pendingFavoriteHashes.delete(detail.hash);

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
 * - Serializes requests per hash so duplicate controls cannot race.
 * - Stops event propagation/default so it is safe inside a <Link>/<summary>.
 * - Resyncs to `initialFavorited` when the prop changes without a remount
 *   (e.g. client-side pagination reuses the component) by adjusting state
 *   during render (https://react.dev/learn/you-might-not-need-an-effect).
 * - Caches and broadcasts optimistic updates, pending state, and rollbacks so
 *   duplicate thumbnails stay synchronized even when they mount later.
 *
 * @param hash - post hash the toggle acts on
 * @param initialFavorited - server-rendered favorite state
 */
export function useFavoriteToggle(hash: string, initialFavorited: boolean) {
  const [favorited, setFavorited] = useState(() =>
    getLatestFavoriteState(hash, initialFavorited)
  );
  const [pending, setPending] = useState(() => pendingFavoriteHashes.has(hash));

  useEffect(() => {
    const syncFavoriteState = (event: Event) => {
      const { detail } = event as CustomEvent<FavoriteStateChangedDetail>;
      if (detail.hash === hash) {
        setFavorited(detail.favorited);
        setPending(detail.pending);
      }
    };

    window.addEventListener(FAVORITE_STATE_CHANGED_EVENT, syncFavoriteState);
    return () => window.removeEventListener(FAVORITE_STATE_CHANGED_EVENT, syncFavoriteState);
  }, [hash]);

  // Prop can change without remount (e.g. client-side pagination) — resync.
  const [prevSource, setPrevSource] = useState({ hash, initialFavorited });
  if (prevSource.hash !== hash || prevSource.initialFavorited !== initialFavorited) {
    setPrevSource({ hash, initialFavorited });
    setFavorited(getLatestFavoriteState(hash, initialFavorited));
    setPending(pendingFavoriteHashes.has(hash));
  }

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (pendingFavoriteHashes.has(hash)) return;

    const next = !favorited;
    broadcastFavoriteState({ hash, favorited: next, pending: true });
    try {
      const response = await fetch(`/api/posts/${hash}/favorite`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!response.ok) {
        broadcastFavoriteState({ hash, favorited: !next, pending: false });
      } else {
        broadcastFavoriteState({ hash, favorited: next, pending: false });
      }
    } catch {
      broadcastFavoriteState({ hash, favorited: !next, pending: false });
    }
  };

  return { favorited, pending, toggle };
}
