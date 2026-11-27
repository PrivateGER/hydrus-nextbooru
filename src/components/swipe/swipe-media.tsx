"use client";

import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { ChevronDoubleDownIcon, FilmIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import { BlurhashImage } from "@/components/blurhash-image";
import type { DeckPost } from "@/lib/feed-deck";
import { fitMode, type FitMode, type MediaPreload } from "@/lib/swipe";

export interface SwipeMediaHandle {
  /** Play/pause a video card; no-op for images. */
  togglePlay(): void;
  /**
   * The vertically scrollable element for tall images, else null. The card
   * owns all touch input (touch-action: none) and scrolls this itself, so a
   * native pan can never steal a swipe.
   */
  scroller(): HTMLElement | null;
}

interface SwipeMediaProps {
  post: DeckPost;
  /** Only the top card plays video and receives input. */
  active: boolean;
  /**
   * How much to load ahead of time (see {@link stackPreload}). Cards beneath
   * the top buffer their file so a swipe reveals media that is already there.
   */
  preload: MediaPreload;
  /** The media is up (or failed for good): the deck may start on the next card. */
  onReady?: () => void;
  muted: boolean;
  onToggleMute: () => void;
  /** Unmuted autoplay was refused by the browser; the deck falls back to muted. */
  onAutoplayBlocked: () => void;
  ref?: Ref<SwipeMediaHandle>;
}

export function thumbnailUrl(hash: string, size: "grid" | "preview" = "preview"): string {
  return `/api/thumbnails/${hash}.webp${size === "preview" ? "?size=preview" : ""}`;
}

export function fileUrl(post: Pick<DeckPost, "hash" | "extension">): string {
  return `/api/files/${post.hash}${post.extension}`;
}

/**
 * Full-bleed media for one swipe card.
 *
 * Layers, back to front:
 * 1. Backdrop: the blurhash stretched to cover the card. A 32x32 canvas
 *    upscaled by the browser is already a soft blur, so letterboxed media
 *    sits on its own colours with no CSS filter cost during swipe animations.
 * 2. Preview thumbnail (600px) as soon as it arrives.
 * 3. Full file faded in over it once decoded (images), or the video itself.
 *
 * Very tall stills switch to a vertically scrolling full-width layout (see
 * {@link fitMode}); everything else is shown whole.
 */
export function SwipeMedia({
  post,
  active,
  preload,
  onReady,
  muted,
  onToggleMute,
  onAutoplayBlocked,
  ref,
}: SwipeMediaProps) {
  const isVideo = post.mimeType.startsWith("video/");
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FitMode>("contain");

  // Re-evaluate fit on resize/rotation. Videos always contain.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || isVideo) return;
    const update = () => setMode(fitMode(post.width, post.height, el.clientWidth, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVideo, post.width, post.height]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-zinc-900">
      <Backdrop post={post} />
      {isVideo ? (
        <SwipeVideo
          post={post}
          active={active}
          preload={preload}
          onReady={onReady}
          muted={muted}
          onToggleMute={onToggleMute}
          onAutoplayBlocked={onAutoplayBlocked}
          ref={ref}
        />
      ) : (
        <SwipeImage post={post} mode={mode} active={active} preload={preload} onReady={onReady} ref={ref} />
      )}
    </div>
  );
}

function Backdrop({ post }: { post: DeckPost }) {
  return (
    <>
      {post.blurhash ? (
        <BlurhashImage
          blurhash={post.blurhash}
          width={post.width ?? 1}
          height={post.height ?? 1}
          className="absolute inset-0 h-full w-full scale-110 object-cover"
        />
      ) : (
        // No blurhash: a heavily blurred grid thumbnail stands in.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl(post.hash, "grid")}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
        />
      )}
      {/* Dim so the media itself stays the focus and captions stay legible. */}
      <div className="absolute inset-0 bg-black/45" aria-hidden />
    </>
  );
}

interface LayeredImageState {
  previewLoaded: boolean;
  previewFailed: boolean;
  fullLoaded: boolean;
  fullFailed: boolean;
}

function SwipeImage({
  post,
  mode,
  active,
  preload,
  onReady,
  ref,
}: {
  post: DeckPost;
  mode: FitMode;
  active: boolean;
  preload: MediaPreload;
  onReady?: () => void;
  ref?: Ref<SwipeMediaHandle>;
}) {
  const [state, setState] = useState<LayeredImageState>({
    previewLoaded: false,
    previewFailed: false,
    fullLoaded: false,
    fullFailed: false,
  });
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Latched: once the full file is requested it stays, even if an undo pushes
  // this card back down the stack.
  const [wantFull, setWantFull] = useState(preload === "auto");
  if (preload === "auto" && !wantFull) setWantFull(true);

  const reportReady = useEffectEvent(() => onReady?.());
  useEffect(() => {
    if (state.fullLoaded || state.fullFailed) reportReady();
  }, [state.fullLoaded, state.fullFailed]);

  useImperativeHandle(ref, () => ({ togglePlay() {}, scroller: () => scrollRef.current }), []);

  // A card scrolled while underneath (impossible today) or returned via undo
  // starts at the top again.
  useEffect(() => {
    if (active && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [active]);

  const failed = state.previewFailed && state.fullFailed;
  const set = (patch: Partial<LayeredImageState>) => setState((s) => ({ ...s, ...patch }));

  // Settle already-cached images whose load event fired before hydration.
  const settle = (key: "previewLoaded" | "fullLoaded") => (node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setState((s) => (s[key] ? s : { ...s, [key]: true }));
    }
  };

  const layers = (fit: string) => (
    <>
      {!state.previewFailed && !state.fullLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={settle("previewLoaded")}
          src={thumbnailUrl(post.hash)}
          alt=""
          draggable={false}
          onLoad={() => set({ previewLoaded: true })}
          onError={() => set({ previewFailed: true })}
          className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-200 ${
            state.previewLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {wantFull && !state.fullFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={settle("fullLoaded")}
          src={fileUrl(post)}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={active ? "high" : "low"}
          onLoad={() => set({ fullLoaded: true })}
          onError={() => set({ fullFailed: true })}
          className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-300 ${
            state.fullLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-300">
        <PhotoIcon className="h-10 w-10" aria-hidden />
        <p className="text-sm">Couldn&apos;t load this image</p>
      </div>
    );
  }

  if (mode === "scroll" && post.width && post.height) {
    return (
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          if (!scrolled && event.currentTarget.scrollTop > 24) setScrolled(true);
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${post.width} / ${post.height}` }}>
          {layers("object-cover")}
        </div>
        {/* Room so the end of the strip clears the caption overlay. */}
        <div className="h-28" aria-hidden />
        {active && !scrolled && (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <ChevronDoubleDownIcon className="h-3.5 w-3.5 animate-bounce" aria-hidden />
              Tall image, scroll to see more
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {layers("object-contain")}
      {!state.previewLoaded && !state.fullLoaded && <Spinner />}
    </>
  );
}

function Spinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </div>
  );
}

function SwipeVideo({
  post,
  active,
  preload,
  onReady,
  muted,
  onToggleMute,
  onAutoplayBlocked,
  ref,
}: {
  post: DeckPost;
  active: boolean;
  preload: MediaPreload;
  onReady?: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onAutoplayBlocked: () => void;
  ref?: Ref<SwipeMediaHandle>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  // Missing file or unsupported codec: no loadeddata ever fires.
  const [failed, setFailed] = useState(false);
  // Playback ran past the buffered data (slow network) and is waiting.
  const [buffering, setBuffering] = useState(false);
  // Brief play glyph after resuming; the paused state shows its own.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showFlash = () => {
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 500);
  };

  // Reads the latest mute preference without re-running the play effect.
  const startPlayback = useEffectEvent((video: HTMLVideoElement) => {
    video.muted = muted;
    video.play().catch((error: unknown) => {
      const blocked = error instanceof DOMException && error.name === "NotAllowedError";
      if (blocked && !video.muted) {
        // Unmuted autoplay needs a fresh user gesture on some browsers.
        video.muted = true;
        onAutoplayBlocked();
        video.play().catch(() => setPaused(true));
      } else if (blocked) {
        setPaused(true);
      }
      // Anything else (NotSupportedError, AbortError) is a media failure
      // that the element's error event reports, or a superseded play().
    });
  });
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const reportReady = useEffectEvent(() => onReady?.());
  useEffect(() => {
    if (ready || failed) reportReady();
  }, [ready, failed]);

  // Pushed back down the stack (an undo put another card on top): start over
  // when it returns, as it did back when only the top card had a <video>.
  useEffect(() => {
    const video = videoRef.current;
    if (!active && video && video.currentTime > 0) video.currentTime = 0;
  }, [active]);

  useImperativeHandle(
    ref,
    () => ({
      togglePlay() {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          video.play().catch(() => {});
          showFlash();
        } else {
          video.pause();
        }
      },
      scroller: () => null,
    }),
    []
  );

  // `muted` must be driven through the property: React does not keep the
  // attribute in sync after mount.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Play while this is the top card; pause synchronously when it stops being
  // one or the route is hidden (cacheComponents keeps left pages mounted in a
  // hidden <Activity>, and passive cleanups can run late — see MediaViewer).
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    startPlayback(video);
    const onVisibility = () => {
      if (document.hidden) video.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      video.pause();
    };
  }, [active]);

  // Smooth progress bar: rAF while playing, written straight to the DOM.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    let frame = 0;
    const tick = () => {
      if (progressRef.current && video.duration > 0) {
        progressRef.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <>
      {/* Every stacked card mounts its <video> so it buffers while it waits
          (as far as `preload` allows); the thumbnail covers it until the
          first frame is decoded. Only the top card plays. */}
      {(!ready || failed) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl(post.hash)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {!failed && (
        <video
          ref={videoRef}
          src={fileUrl(post)}
          className="absolute inset-0 h-full w-full object-contain"
          loop
          muted
          playsInline
          preload={preload}
          disablePictureInPicture
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
        />
      )}
      {active && (!ready || buffering) && !failed && <Spinner />}
      {active && failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-zinc-200">
          <FilmIcon className="h-10 w-10" aria-hidden />
          <p className="text-sm">Couldn&apos;t play this video</p>
        </div>
      )}

      {active && !failed && post.hasAudio && (
        <button
          type="button"
          data-no-swipe
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition active:scale-90"
        >
          {muted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
        </button>
      )}

      {active && !failed && (paused || flash) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <PlayIcon className="ml-1 h-8 w-8" aria-hidden />
          </span>
        </div>
      )}

      {active && !failed && (
        <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/20" aria-hidden>
          <div ref={progressRef} className="h-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
        </div>
      )}
    </>
  );
}
