"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  HeartIcon as HeartOutlineIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon, XMarkIcon } from "@heroicons/react/24/solid";
import type { DeckPost, DeckResult } from "@/lib/feed-deck";
import {
  SWIPE_HISTORY_KEY,
  parseHistory,
  recordSwipe,
  removeSwipe,
  type SwipeAction,
  type SwipeHistoryEntry,
} from "@/lib/swipe";
import { SwipeCard, type SwipeCardHandle } from "./swipe-card";
import { fileUrl, thumbnailUrl } from "./swipe-media";

/** Refill when this few cards are left in the local queue. */
const REFILL_AT = 5;
const BATCH_SIZE = 10;
/** Cards rendered in the stack: top, the one beneath, and one more preloading. */
const STACK_DEPTH = 3;
const UNDO_DEPTH = 30;
const HINT_KEY = "swipe-feed-hint-seen-v1";

type LoadState = "loading" | "ready" | "error";

interface UndoEntry {
  /** Identifies this swipe; see `latestSwipeByHash`. */
  id: number;
  post: DeckPost;
  action: SwipeAction;
}

function readHistory(): SwipeHistoryEntry[] {
  try {
    return parseHistory(window.localStorage.getItem(SWIPE_HISTORY_KEY), Date.now());
  } catch {
    return [];
  }
}

function writeHistory(entries: SwipeHistoryEntry[]) {
  try {
    window.localStorage.setItem(SWIPE_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked (private mode): history is best-effort.
  }
}

/**
 * Full-screen, Tinder-style deck over the "For You" ranking.
 *
 * Swipe right likes (favorites) the post, swipe left skips it. Skips are not
 * sent to the server; the device remembers swiped hashes (see
 * {@link SwipeHistoryEntry}) and excludes them when asking for more cards.
 */
export function SwipeDeck() {
  const [queue, setQueue] = useState<DeckPost[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [exhausted, setExhausted] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [entering, setEntering] = useState<{ hash: string; from: "left" | "right" } | null>(null);
  /**
   * Bumped whenever a card is put back on top (undo, failed like). It is part
   * of the React key so the card always remounts fresh: a fast failure can
   * remove and re-add the same post in one batched render, which would
   * otherwise reuse the instance still parked off-screen from its fly-out.
   */
  const [revivals, setRevivals] = useState<Record<string, number>>({});
  const revive = useCallback((hash: string, from: "left" | "right") => {
    setRevivals((current) => ({ ...current, [hash]: (current[hash] ?? 0) + 1 }));
    setEntering({ hash, from });
  }, []);
  const [muted, setMuted] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showHint, setShowHint] = useState(false);
  const router = useRouter();

  const stackRef = useRef<HTMLDivElement>(null);
  const topCardRef = useRef<SwipeCardHandle>(null);
  const historyRef = useRef<SwipeHistoryEntry[]>([]);
  const queueRef = useRef<DeckPost[]>([]);
  /** The in-flight deck request, if any. Aborted requests no longer count as in flight. */
  const abortRef = useRef<AbortController | null>(null);
  const pendingByHash = useRef(new Map<string, Promise<unknown>>());
  /**
   * The newest swipe per post. A like's failure handler rolls back only if
   * its swipe is still the newest: after an undo (or undo + re-swipe) while
   * the request was in flight, the newer action owns the state.
   */
  const latestSwipeByHash = useRef(new Map<string, number>());
  const nextSwipeId = useRef(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hintCheckedRef = useRef(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /**
   * Written straight to the DOM (no re-render per pointer move). While the
   * finger is down the beneath card tracks it 1:1; on release its transition
   * is re-enabled so it eases to rest or to the front.
   */
  const setProgress = useCallback((progress: number, live: boolean) => {
    const stack = stackRef.current;
    if (!stack) return;
    stack.style.setProperty("--swipe-progress", String(progress));
    if (live) stack.dataset.dragging = "";
    else delete stack.dataset.dragging;
  }, []);

  const refill = useCallback(async () => {
    // One live request at a time, but an aborted one (effect cleanup on
    // Strict Mode remount or a hidden <Activity>) must not block the request
    // the re-run effect starts: its own finally only settles later.
    if (abortRef.current && !abortRef.current.signal.aborted) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Queued cards first, then history newest-first, so the server's cap
      // drops the oldest swipes if it ever applies.
      const exclude = [
        ...queueRef.current.map((post) => post.hash),
        ...historyRef.current.map((entry) => entry.hash).reverse(),
      ];
      const response = await fetch("/api/feed/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclude, limit: BATCH_SIZE }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Deck request failed: ${response.status}`);
      const data = (await response.json()) as DeckResult;
      if (controller.signal.aborted) return;

      const seen = new Set(historyRef.current.map((entry) => entry.hash));
      setQueue((current) => {
        const queued = new Set(current.map((post) => post.hash));
        const fresh = data.posts.filter((post) => !queued.has(post.hash) && !seen.has(post.hash));
        return fresh.length > 0 ? [...current, ...fresh] : current;
      });
      setRemaining(data.remaining);
      setTotalCount(data.totalCount);
      setExhausted(data.posts.length === 0 || data.remaining === 0);
      setLoadState("ready");
      if (!hintCheckedRef.current) {
        hintCheckedRef.current = true;
        try {
          setShowHint(window.localStorage.getItem(HINT_KEY) === null);
        } catch {
          // Storage blocked: skip the hint rather than show it every visit.
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      setLoadState("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  // Mount: load history, first batch, and lock the page behind the deck.
  useEffect(() => {
    historyRef.current = readHistory();
    void refill();

    const html = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = html.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none"; // no pull-to-refresh mid-swipe
    return () => {
      abortRef.current?.abort();
      document.body.style.overflow = previousOverflow;
      html.style.overscrollBehavior = previousOverscroll;
    };
  }, [refill]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Keep a few cards ahead.
  useEffect(() => {
    if (loadState === "ready" && !exhausted && queue.length <= REFILL_AT) void refill();
  }, [queue.length, loadState, exhausted, refill]);

  // Warm the cache for the card after the rendered stack.
  useEffect(() => {
    const next = queue[STACK_DEPTH];
    if (!next) return;
    const image = new Image();
    image.src = next.mimeType.startsWith("video/") ? thumbnailUrl(next.hash) : fileUrl(next);
  }, [queue]);

  /** Serialize requests per post so an undo never overtakes its like. */
  const chain = useCallback((hash: string, task: () => Promise<boolean>): Promise<boolean> => {
    const previous = pendingByHash.current.get(hash) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    pendingByHash.current.set(hash, next);
    void next.finally(() => {
      if (pendingByHash.current.get(hash) === next) pendingByHash.current.delete(hash);
    });
    return next;
  }, []);

  const setFavorite = useCallback(
    (hash: string, favorited: boolean) =>
      chain(hash, async () => {
        try {
          const response = await fetch(`/api/posts/${hash}/favorite`, { method: favorited ? "PUT" : "DELETE" });
          return response.ok;
        } catch {
          return false;
        }
      }),
    [chain]
  );

  const dismissHint = useCallback(() => {
    setShowHint((visible) => {
      if (visible) {
        try {
          window.localStorage.setItem(HINT_KEY, "1");
        } catch {
          // ignore
        }
      }
      return false;
    });
  }, []);

  const commit = useCallback(
    (post: DeckPost, action: SwipeAction) => {
      const id = nextSwipeId.current++;
      latestSwipeByHash.current.set(post.hash, id);
      setProgress(0, false);
      setEntering(null);
      setQueue((current) => current.filter((p) => p.hash !== post.hash));
      historyRef.current = recordSwipe(historyRef.current, { hash: post.hash, action, at: Date.now() }, Date.now());
      writeHistory(historyRef.current);
      setUndoStack((stack) => [...stack.slice(-(UNDO_DEPTH - 1)), { id, post, action }]);
      setAnnouncement(action === "like" ? "Liked" : "Skipped");

      if (action === "like") {
        void setFavorite(post.hash, true).then((ok) => {
          if (ok) return;
          // Superseded by a later undo or swipe of this post: leave its state alone.
          if (latestSwipeByHash.current.get(post.hash) !== id) return;
          latestSwipeByHash.current.delete(post.hash);
          // Put the card back so the like is not silently lost.
          historyRef.current = removeSwipe(historyRef.current, post.hash);
          writeHistory(historyRef.current);
          setUndoStack((stack) => stack.filter((entry) => entry.id !== id));
          setQueue((current) => [post, ...current.filter((p) => p.hash !== post.hash)]);
          revive(post.hash, "right");
          showToast("Couldn't save that like. Try again.");
        });
      }
    },
    [setFavorite, showToast, setProgress, revive]
  );

  const undo = useCallback(() => {
    if (topCardRef.current?.isBusy()) return;
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((stack) => stack.slice(0, -1));
    latestSwipeByHash.current.delete(last.post.hash);
    historyRef.current = removeSwipe(historyRef.current, last.post.hash);
    writeHistory(historyRef.current);
    setQueue((current) => [last.post, ...current.filter((p) => p.hash !== last.post.hash)]);
    revive(last.post.hash, last.action === "like" ? "right" : "left");
    setExhausted(false);
    setAnnouncement("Undone");
    if (last.action === "like") {
      void setFavorite(last.post.hash, false).then((ok) => {
        if (!ok) showToast("Couldn't remove that like. It's still in your favorites.");
      });
    }
  }, [undoStack, setFavorite, showToast, revive]);

  const swipe = useCallback(
    (action: SwipeAction) => {
      if (queueRef.current.length === 0) return;
      topCardRef.current?.fling(action);
    },
    []
  );

  const startOver = useCallback(() => {
    historyRef.current = [];
    writeHistory([]);
    setUndoStack([]);
    setQueue([]);
    setExhausted(false);
    setLoadState("loading");
    void refill();
  }, [refill]);

  const retry = useCallback(() => {
    setLoadState("loading");
    void refill();
  }, [refill]);

  const top = queue[0];

  // Keyboard: ← skip, → like, Backspace/Z undo, Space play/pause, Enter open, M mute.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          swipe("like");
          break;
        case "ArrowLeft":
          event.preventDefault();
          swipe("skip");
          break;
        case "Backspace":
        case "z":
        case "Z":
          event.preventDefault();
          undo();
          break;
        case " ":
          if (target?.closest("button, a")) return;
          event.preventDefault();
          topCardRef.current?.togglePlay();
          break;
        case "m":
        case "M":
          setMuted((value) => !value);
          break;
        case "Enter":
          if (target?.closest("button, a")) return;
          if (top) router.push(`/post/${top.hash}`);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [swipe, undo, top, router]);

  const remainingLabel =
    remaining === null
      ? null
      : remaining + queue.length === 0
        ? "All caught up"
        : `${remaining + queue.length} left`;

  const isEmptyFeed = loadState === "ready" && totalCount === 0;
  const isCaughtUp = loadState === "ready" && !isEmptyFeed && queue.length === 0 && exhausted;
  const isWaiting = queue.length === 0 && !isEmptyFeed && !isCaughtUp && loadState !== "error";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] sm:px-4">
        <Link
          href="/recommended"
          aria-label="Back to For You"
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-200 active:scale-90 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <div className="text-center leading-tight">
          <h1 className="text-sm font-semibold">For You</h1>
          <p className="h-4 text-xs text-zinc-500 tabular-nums dark:text-zinc-400" aria-live="polite">
            {remainingLabel}
          </p>
        </div>
        <span className="h-10 w-10" aria-hidden />
      </header>

      {/* Card stack */}
      <main className="relative min-h-0 flex-1 px-2 sm:px-4">
        <div
          ref={stackRef}
          className="group/stack relative mx-auto h-full w-full max-w-2xl"
          style={{ "--swipe-progress": 0 } as CSSProperties}
        >
          {queue
            .slice(0, STACK_DEPTH)
            .map((post, index) => {
              const isTop = index === 0;
              // Beneath cards scale up as the top card is dragged away.
              const style: CSSProperties | undefined = isTop
                ? { zIndex: STACK_DEPTH }
                : index === 1
                  ? {
                      zIndex: STACK_DEPTH - 1,
                      transform:
                        "translateY(calc((1 - var(--swipe-progress)) * 12px)) scale(calc(0.94 + 0.06 * var(--swipe-progress)))",
                    }
                  : { zIndex: STACK_DEPTH - 2, transform: "translateY(12px) scale(0.94)" };
              return (
                <div
                  key={`${post.hash}:${revivals[post.hash] ?? 0}`}
                  className="absolute inset-0 transition-transform duration-200 ease-out group-data-[dragging]/stack:transition-none"
                  style={style}
                >
                  <SwipeCard
                    ref={isTop ? topCardRef : undefined}
                    post={post}
                    active={isTop}
                    muted={muted}
                    enterFrom={entering?.hash === post.hash ? entering.from : undefined}
                    onToggleMute={() => setMuted((value) => !value)}
                    onAutoplayBlocked={() => setMuted(true)}
                    onCommit={(action) => commit(post, action)}
                    onProgress={setProgress}
                    onInteract={dismissHint}
                  />
                </div>
              );
            })
            .reverse()}

          {showHint && top && <SwipeHint />}

          {isWaiting && <SkeletonCard />}
          {loadState === "error" && queue.length === 0 && (
            <StateCard
              icon={<ExclamationTriangleIcon className="h-10 w-10" />}
              title="Couldn't load your feed"
              body="Check your connection and try again."
              actions={
                <button type="button" onClick={retry} className={primaryButton}>
                  <ArrowPathIcon className="h-4 w-4" /> Retry
                </button>
              }
            />
          )}
          {isEmptyFeed && (
            <StateCard
              icon={<HeartOutlineIcon className="h-10 w-10" />}
              title="Your feed is empty"
              body="Favorite some posts and recommendations will show up here."
              actions={
                <Link href="/" className={primaryButton}>
                  Browse the gallery
                </Link>
              }
            />
          )}
          {isCaughtUp && (
            <StateCard
              icon={<SparklesIcon className="h-10 w-10" />}
              title="You're all caught up"
              body="You've swiped through every recommendation. Like more posts and new ones will appear here."
              actions={
                <>
                  <button type="button" onClick={startOver} className={primaryButton}>
                    <ArrowPathIcon className="h-4 w-4" /> Start over
                  </button>
                  <Link href="/recommended" className={secondaryButton}>
                    Back to For You
                  </Link>
                </>
              }
            />
          )}
        </div>
      </main>

      {/* Action bar */}
      <footer className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="mx-auto flex max-w-sm items-center justify-between">
          <RoundButton
            label="Undo"
            onClick={undo}
            disabled={undoStack.length === 0}
            size="sm"
            className="text-amber-500"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </RoundButton>
          <RoundButton label="Skip" onClick={() => swipe("skip")} disabled={!top} size="lg" className="text-zinc-500 dark:text-zinc-300">
            <XMarkIcon className="h-8 w-8" />
          </RoundButton>
          <RoundButton label="Like" onClick={() => swipe("like")} disabled={!top} size="lg" className="text-pink-500">
            <HeartIcon className="h-8 w-8" />
          </RoundButton>
          {top ? (
            <Link
              href={`/post/${top.hash}`}
              aria-label="Open full post"
              title="Open full post"
              className={`${roundBase} h-12 w-12 text-sky-500`}
            >
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </Link>
          ) : (
            <RoundButton label="Open full post" disabled size="sm" className="text-sky-500">
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </RoundButton>
          )}
        </div>
        <p className="mt-2 hidden text-center text-xs text-zinc-400 md:block dark:text-zinc-500">
          ← skip · → like · Backspace undo · Space play/pause · Enter open
        </p>
      </footer>

      {/* Toast + screen-reader announcements */}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),0.5rem)+3.5rem)] z-[70] flex justify-center px-4" aria-live="assertive">
        {toast && (
          <div className="pointer-events-auto rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur dark:bg-zinc-100/90 dark:text-zinc-900">
            {toast}
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const roundBase =
  "flex items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition duration-150 hover:shadow-lg active:scale-90 disabled:opacity-40 disabled:active:scale-100 dark:bg-zinc-800 dark:ring-white/10";
const primaryButton =
  "inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-pink-500 active:scale-95";
const secondaryButton =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200 active:scale-95 dark:text-zinc-300 dark:hover:bg-zinc-800";

function RoundButton({
  label,
  onClick,
  disabled,
  size,
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size: "sm" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${roundBase} ${size === "lg" ? "h-16 w-16" : "h-12 w-12"} ${className}`}
    >
      {children}
    </button>
  );
}

function StateCard({
  icon,
  title,
  body,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-300 px-8 text-center dark:border-zinc-700">
      <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="absolute inset-0 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" aria-label="Loading">
      <div className="absolute inset-x-4 bottom-5 space-y-2">
        <div className="h-5 w-1/3 rounded bg-zinc-300 dark:bg-zinc-700" />
        <div className="h-3 w-1/2 rounded bg-zinc-300 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function SwipeHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
      <div className="flex items-center gap-4 rounded-full bg-black/65 px-5 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block animate-pulse">←</span> Skip
        </span>
        <span className="h-4 w-px bg-white/30" aria-hidden />
        <span className="flex items-center gap-1.5">
          Like <span aria-hidden className="inline-block animate-pulse">→</span>
        </span>
      </div>
    </div>
  );
}
