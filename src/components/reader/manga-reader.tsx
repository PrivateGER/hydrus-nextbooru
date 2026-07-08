"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { decode } from "blurhash";
import {
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsPointingOutIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import {
  type FitMode,
  clampPage,
  nextFitMode,
  preloadTargets,
  progressKey,
  readerHref,
  resolvePageAction,
  serializeProgress,
  stepPage,
} from "@/lib/reader";
import { buildPostUrl } from "@/lib/post-navigation";

export interface ReaderPage {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  extension: string;
}

interface MangaReaderProps {
  groupId: number;
  title: string;
  pages: ReaderPage[];
  initialPage: number;
}

const FIT_LABELS: Record<FitMode, string> = {
  contain: "Fit page",
  width: "Fit width",
  original: "Original size",
};

const PREFS_KEY = "reader-prefs";

interface ReaderPrefs {
  fit: FitMode;
  rtl: boolean;
}

function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
      return {
        fit: parsed.fit === "width" || parsed.fit === "original" ? parsed.fit : "contain",
        rtl: parsed.rtl === true,
      };
    }
  } catch {
    // Corrupt prefs: fall through to defaults.
  }
  return { fit: "contain", rtl: false };
}

function fileUrl(page: ReaderPage): string {
  return `/api/files/${page.hash}${page.extension}`;
}

/** Ignore reader hotkeys while the user is typing somewhere. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Full-screen, e-hentai style reader for one group.
 *
 * Page turns are pure client state: every member is passed in up front, the
 * URL is kept in sync with history.replaceState (one history entry total, so
 * the browser back button exits the reader in one step), and neighboring
 * full-resolution images are preloaded so turning feels instant.
 *
 * Mobile: taps on the screen edges page and a center tap toggles the chrome
 * (computed from the click position, so nothing overlays the media — native
 * video controls, vertical panning, and pinch zoom keep working), horizontal
 * swipes page, the bars pad themselves past notches via safe-area insets,
 * and heights use dvh so the collapsing browser toolbar doesn't cover the
 * bottom bar.
 */
export function MangaReader({ groupId, title, pages, initialPage }: MangaReaderProps) {
  const router = useRouter();
  const total = pages.length;

  const [page, setPage] = useState(() => clampPage(initialPage, total));
  const [fit, setFit] = useState<FitMode>("contain");
  const [rtl, setRtl] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [stripVisible, setStripVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentThumbRef = useRef<HTMLButtonElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadedRef = useRef(new Map<string, HTMLImageElement>());

  const current = pages[page - 1];
  const isVideo = current.mimeType.startsWith("video/");
  const isImage = current.mimeType.startsWith("image/");

  // ---- preferences ----------------------------------------------------

  // Deferred like post-grid's layout restore: reading localStorage after
  // hydration avoids a server/client mismatch, and the timeout keeps the
  // setState out of the synchronous effect body.
  useEffect(() => {
    const prefs = loadPrefs();
    const timeout = window.setTimeout(() => {
      setFit(prefs.fit);
      setRtl(prefs.rtl);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const persistPrefs = useCallback(
    (next: Partial<ReaderPrefs>) => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ fit, rtl, ...next }));
      } catch {
        // Storage full/unavailable: prefs just don't stick.
      }
    },
    [fit, rtl]
  );

  const cycleFit = useCallback(() => {
    setFit((mode) => {
      const next = nextFitMode(mode);
      persistPrefs({ fit: next });
      return next;
    });
  }, [persistPrefs]);

  const toggleRtl = useCallback(() => {
    setRtl((value) => {
      persistPrefs({ rtl: !value });
      return !value;
    });
  }, [persistPrefs]);

  // ---- chrome auto-hide ------------------------------------------------

  const scheduleChromeHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), 3000);
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const toggleChrome = useCallback(() => {
    setChromeVisible((visible) => {
      if (visible) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        return false;
      }
      scheduleChromeHide();
      return true;
    });
  }, [scheduleChromeHide]);

  useEffect(() => {
    scheduleChromeHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleChromeHide]);

  // ---- page changes ----------------------------------------------------

  const goTo = useCallback(
    (target: number) => {
      const next = clampPage(target, total);
      if (next !== page) {
        setImageLoaded(false);
        setPage(next);
      }
    },
    [page, total]
  );

  const step = useCallback(
    (action: "prev" | "next") => goTo(stepPage(page, total, action)),
    [goTo, page, total]
  );

  // Keep the URL shareable without growing the history stack: the reader
  // occupies a single entry, so Back always exits in one step. Preserve the
  // Next.js router's history state object — replacing it with null breaks
  // app-router back/forward navigation.
  useEffect(() => {
    window.history.replaceState(window.history.state, "", readerHref(groupId, page));
  }, [groupId, page]);

  // Persist reading progress for the "Continue" button on the group page.
  useEffect(() => {
    try {
      localStorage.setItem(
        progressKey(groupId),
        serializeProgress({ page, total, updatedAt: Date.now() })
      );
    } catch {
      // Storage unavailable: progress just isn't remembered.
    }
  }, [groupId, page, total]);

  // Preload neighbors' full-resolution images so page turns feel instant.
  useEffect(() => {
    const keep = new Set([fileUrl(pages[page - 1])]);
    for (const target of preloadTargets(page, total)) {
      const neighbor = pages[target - 1];
      if (!neighbor.mimeType.startsWith("image/")) continue;
      const url = fileUrl(neighbor);
      keep.add(url);
      if (preloadedRef.current.has(url)) continue;
      const img = new Image();
      img.src = url;
      preloadedRef.current.set(url, img);
    }
    // Drop references outside the window: the Image object only needs to
    // live until the fetch lands in the HTTP cache. Without pruning, a long
    // read retains every decoded full-size page for the tab's lifetime.
    for (const url of preloadedRef.current.keys()) {
      if (!keep.has(url)) preloadedRef.current.delete(url);
    }
  }, [page, pages, total]);

  // Reset scroll (fit-width/original modes) on page turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page]);

  // Keep the thumbnail strip centered on the current page.
  useEffect(() => {
    if (!stripVisible) return;
    currentThumbRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [page, stripVisible]);

  // ---- environment -----------------------------------------------------

  // Lock body scroll while the reader overlays the app shell.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const exitHref = `/groups/${groupId}#p${page}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLVideoElement) return;

      switch (e.key) {
        case "ArrowLeft":
          step(resolvePageAction("left", rtl));
          break;
        case "ArrowRight":
          step(resolvePageAction("right", rtl));
          break;
        case "a":
          step("prev");
          break;
        case "d":
          step("next");
          break;
        case " ":
          e.preventDefault();
          step(e.shiftKey ? "prev" : "next");
          break;
        case "Home":
          goTo(1);
          break;
        case "End":
          goTo(total);
          break;
        case "f":
          cycleFit();
          showChrome();
          break;
        case "r":
          toggleRtl();
          showChrome();
          break;
        case "t":
          setStripVisible((v) => !v);
          showChrome();
          break;
        case "Escape":
          router.push(exitHref);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, goTo, total, rtl, router, exitHref, cycleFit, toggleRtl, showChrome]);

  // Pause the current video when paging away or unmounting.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
    };
  }, [page]);

  // ---- touch swipe (media-viewer pattern) --------------------------------

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.pointerType === "mouse") return;
    // Original-size mode pans natively in both axes; a horizontal drag there
    // is scrolling the oversized image, not a page-turn gesture.
    if (fit === "original") return;
    const target = e.target as HTMLElement;
    if (target.closest("video, a, button, input")) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary || !swipeStartRef.current) return;
    const deltaX = e.clientX - swipeStartRef.current.x;
    const deltaY = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      lastSwipeAtRef.current = Date.now();
      // Swiping the sheet left always pulls in the next page regardless of
      // RTL — RTL only remaps taps and arrow keys, like other mobile readers.
      step(deltaX < 0 ? "next" : "prev");
    }
  };

  // Tap zones computed from the click position instead of overlay elements:
  // outer 30% pages, middle toggles the chrome. Clicks on interactive
  // elements (video controls, links, the slider) are ignored.
  const handleMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastSwipeAtRef.current < 400) return;
    const target = e.target as HTMLElement;
    if (target.closest("video, a, button, input")) return;

    const x = e.clientX / window.innerWidth;
    if (x < 0.3) {
      step(resolvePageAction("left", rtl));
    } else if (x > 0.7) {
      step(resolvePageAction("right", rtl));
    } else {
      toggleChrome();
    }
  };

  // ---- blurhash placeholder ---------------------------------------------

  useEffect(() => {
    if (!current.blurhash || !canvasRef.current) return;
    try {
      const pixels = decode(current.blurhash, 32, 32);
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Invalid blurhash: no placeholder.
    }
  }, [current.blurhash]);

  // Cached images can complete before React attaches onLoad; the callback
  // ref catches that case (the img remounts per page via its key).
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, []);

  // ---- layout -----------------------------------------------------------

  const mediaClass =
    fit === "contain"
      ? "max-h-full max-w-full object-contain"
      : fit === "width"
        ? "w-full h-auto"
        : "max-w-none";

  const scrollClass =
    fit === "contain"
      ? "overflow-hidden flex items-center justify-center"
      : fit === "width"
        ? "overflow-y-auto overflow-x-hidden"
        : "overflow-auto";

  const barBase =
    "absolute inset-x-0 z-30 bg-black/80 px-3 text-zinc-100 backdrop-blur transition-transform duration-200";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-zinc-100 select-none"
      style={{
        height: "100dvh",
        // Original-size mode needs horizontal touch panning to reach the full
        // width of an oversized image (swipe paging is disabled there); the
        // other modes reserve horizontal drags for swipe page-turns.
        touchAction: fit === "original" ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom",
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (swipeStartRef.current = null)}
    >
      {/* Top bar */}
      <div
        className={`${barBase} top-0 flex min-h-12 items-center gap-2 py-2 ${
          chromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Link
          href={exitHref}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Back to group"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
          {title}
        </span>
        <button
          type="button"
          onClick={() => {
            cycleFit();
            showChrome();
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs hover:bg-white/10"
          title={`Fit mode: ${FIT_LABELS[fit]} (f)`}
        >
          <ArrowsPointingOutIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{FIT_LABELS[fit]}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            toggleRtl();
            showChrome();
          }}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs hover:bg-white/10 ${
            rtl ? "text-blue-400" : ""
          }`}
          title={`Reading direction: ${rtl ? "right-to-left" : "left-to-right"} (r)`}
        >
          <ArrowsRightLeftIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{rtl ? "RTL" : "LTR"}</span>
        </button>
        <Link
          href={buildPostUrl(current.hash, groupId)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          title="Open post details (tags, sources)"
          aria-label="Open post details"
        >
          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
        </Link>
      </div>

      {/* Media area */}
      <div className="relative min-h-0 flex-1">
        {/* Blurhash placeholder fills the viewport behind the image */}
        {isImage && current.blurhash && !imageLoaded && (
          <canvas
            key={`bh-${current.hash}`}
            ref={canvasRef}
            width={32}
            height={32}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60"
          />
        )}

        <div
          ref={scrollRef}
          className={`relative z-10 h-full ${scrollClass}`}
          onClick={handleMediaClick}
        >
          {isVideo ? (
            <video
              key={current.hash}
              ref={videoRef}
              src={fileUrl(current)}
              controls
              playsInline
              loop
              className={`${mediaClass} mx-auto`}
            >
              Your browser does not support the video tag.
            </video>
          ) : isImage ? (
            <img
              key={current.hash}
              ref={imageRef}
              src={fileUrl(current)}
              alt={`Page ${page} of ${total}`}
              width={current.width ?? undefined}
              height={current.height ?? undefined}
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              className={`${mediaClass} ${fit !== "contain" ? "mx-auto" : ""} transition-opacity duration-150 ${
                imageLoaded ? "opacity-100" : "opacity-40"
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <p>Preview not available for {current.mimeType}</p>
            </div>
          )}
        </div>

        {/* Always-visible minimal page counter */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {page} / {total}
        </div>
      </div>

      {/* Bottom bar: thumbnails + slider */}
      <div
        className={`${barBase} bottom-0 flex flex-col gap-2 py-2 ${
          chromeVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {stripVisible && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {pages.map((p, index) => {
              const isCurrent = index + 1 === page;
              return (
                <button
                  key={p.hash}
                  type="button"
                  ref={isCurrent ? currentThumbRef : null}
                  onClick={() => goTo(index + 1)}
                  className={`relative shrink-0 overflow-hidden rounded ${
                    isCurrent ? "ring-2 ring-blue-500" : "opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                >
                  <img
                    src={`/api/thumbnails/${p.hash}.webp`}
                    alt=""
                    loading="lazy"
                    className="h-16 w-12 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setStripVisible((v) => !v);
              showChrome();
            }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 ${
              stripVisible ? "text-blue-400" : ""
            }`}
            title="Toggle thumbnails (t)"
            aria-label="Toggle thumbnails"
          >
            <RectangleStackIcon className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={1}
            max={total}
            value={page}
            onChange={(e) => goTo(parseInt(e.target.value, 10))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-500"
            style={rtl ? { direction: "rtl" } : undefined}
            aria-label="Page"
          />
          <span className="shrink-0 text-sm tabular-nums text-zinc-300">
            {page} / {total}
          </span>
        </div>
      </div>
    </div>
  );
}
