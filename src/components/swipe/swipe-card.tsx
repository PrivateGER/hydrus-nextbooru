"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";
import type { DeckPost } from "@/lib/feed-deck";
import {
  DRAG_SLOP_PX,
  dragRotation,
  formatDuration,
  formatTagName,
  releaseVelocity,
  resolveSwipe,
  swipeProgress,
  type SwipeAction,
} from "@/lib/swipe";
import { HeartIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { SwipeMedia, type SwipeMediaHandle } from "./swipe-media";

export interface SwipeCardHandle {
  /** Animate the card off-screen as if swiped, then commit. */
  fling(action: SwipeAction): void;
  togglePlay(): void;
  /** True while a fling is animating; further input is ignored. */
  isBusy(): boolean;
}

interface SwipeCardProps {
  post: DeckPost;
  active: boolean;
  muted: boolean;
  /** Undo: slide in from this side instead of appearing in place. */
  enterFrom?: "left" | "right";
  onToggleMute: () => void;
  onAutoplayBlocked: () => void;
  /** Called once the fly-out animation has finished. */
  onCommit: (action: SwipeAction) => void;
  /**
   * Drag progress 0..1 toward the commit threshold (drives the card beneath).
   * `live` is true while the finger is down and false for settle animations.
   */
  onProgress: (progress: number, live: boolean) => void;
  /** First interaction with the deck (hides the onboarding hint). */
  onInteract: () => void;
  ref?: Ref<SwipeCardHandle>;
}

interface DragState {
  pointerId: number | null;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** Decided intent once the pointer leaves the slop radius. */
  mode: "pending" | "swipe" | "scroll" | "ignore";
  dragging: boolean;
  samples: { x: number; t: number }[];
  /** Vertical samples (as `x`) for scroll momentum. */
  scrollSamples: { x: number; t: number }[];
  scroller: HTMLElement | null;
  scrollStart: number;
  /** Side whose threshold was crossed last (for one haptic tick per crossing). */
  armed: SwipeAction | null;
}

const SPRING_BACK = "transform 420ms cubic-bezier(0.175, 0.885, 0.32, 1.275)";
const STAMP_FADE = "opacity 200ms ease-out";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function haptic(ms: number) {
  // Android only; iOS Safari has no Vibration API.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}

export function SwipeCard({
  post,
  active,
  muted,
  enterFrom,
  onToggleMute,
  onAutoplayBlocked,
  onCommit,
  onProgress,
  onInteract,
  ref,
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const likeStampRef = useRef<HTMLDivElement>(null);
  const skipStampRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<SwipeMediaHandle>(null);
  const busyRef = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<DragState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    mode: "pending",
    dragging: false,
    samples: [],
    scrollSamples: [],
    scroller: null,
    scrollStart: 0,
    armed: null,
  });
  const inertiaFrame = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(commitTimer.current);
      cancelAnimationFrame(inertiaFrame.current);
    },
    []
  );

  /** Coast a released vertical scroll to rest (velocity in px/ms, positive = finger moving down). */
  const coast = (scroller: HTMLElement, velocity: number) => {
    cancelAnimationFrame(inertiaFrame.current);
    if (prefersReducedMotion()) return;
    let v = velocity;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const before = scroller.scrollTop;
      scroller.scrollTop = before - v * dt;
      v *= Math.pow(0.95, dt / 16);
      const stuck = scroller.scrollTop === before;
      if (Math.abs(v) > 0.02 && !stuck) inertiaFrame.current = requestAnimationFrame(step);
    };
    inertiaFrame.current = requestAnimationFrame(step);
  };

  const setStamps = (dx: number, progress: number, transition: string) => {
    const like = likeStampRef.current;
    const skip = skipStampRef.current;
    if (!like || !skip) return;
    // Fade and scale together (transition strings name opacity; mirror for scale).
    const both = transition === "none" ? "none" : `${transition}, ${transition.replace("opacity", "scale")}`;
    like.style.transition = both;
    skip.style.transition = both;
    like.style.opacity = dx > 0 ? String(progress) : "0";
    skip.style.opacity = dx < 0 ? String(progress) : "0";
    like.style.scale = String(0.85 + 0.15 * (dx > 0 ? progress : 0));
    skip.style.scale = String(0.85 + 0.15 * (dx < 0 ? progress : 0));
  };

  const applyDrag = (dx: number, dy: number) => {
    const card = cardRef.current;
    if (!card) return;
    const width = card.offsetWidth;
    const reduced = prefersReducedMotion();
    const rotation = reduced ? 0 : dragRotation(dx, width);
    // A little vertical follow makes the card feel held, not railed.
    const lift = Math.max(-40, Math.min(40, dy * 0.2));
    card.style.transition = "none";
    card.style.transform = `translate3d(${dx}px, ${lift}px, 0) rotate(${rotation}deg)`;
    const progress = swipeProgress(dx, width);
    setStamps(dx, progress, "none");
    onProgress(progress, true);

    const side: SwipeAction | null = progress >= 1 ? (dx > 0 ? "like" : "skip") : null;
    if (side && drag.current.armed !== side) haptic(8);
    drag.current.armed = side;
  };

  const springBack = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = prefersReducedMotion() ? "transform 120ms ease-out" : SPRING_BACK;
    card.style.transform = "";
    setStamps(0, 0, STAMP_FADE);
    onProgress(0, false);
  };

  const flyOut = (action: SwipeAction, velocity = 0) => {
    const card = cardRef.current;
    if (!card || busyRef.current) return;
    busyRef.current = true;
    const direction = action === "like" ? 1 : -1;
    const reduced = prefersReducedMotion();
    const distance = window.innerWidth / 2 + card.offsetWidth * 1.2;
    // Faster flicks leave faster, but never so fast the exit is invisible.
    const duration = reduced ? 120 : Math.round(Math.max(180, Math.min(320, distance / Math.max(Math.abs(velocity), 1.6))));
    const lift = Math.max(-40, Math.min(40, drag.current.dy * 0.2)) + (reduced ? 0 : 30);
    card.style.transition = `transform ${duration}ms cubic-bezier(0.3, 0.6, 0.4, 1)`;
    card.style.transform = `translate3d(${direction * distance}px, ${lift}px, 0) rotate(${reduced ? 0 : direction * 22}deg)`;
    setStamps(direction, 1, "opacity 120ms ease-out");
    onProgress(1, false);
    haptic(12);
    commitTimer.current = setTimeout(() => onCommit(action), duration);
  };

  useImperativeHandle(
    ref,
    () => ({
      fling(action) {
        onInteract();
        flyOut(action);
      },
      togglePlay() {
        mediaRef.current?.togglePlay();
      },
      isBusy() {
        return busyRef.current || drag.current.dragging;
      },
    })
  );

  // Undo: start off-screen on the side the card left from and glide back.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !enterFrom) return;
    const direction = enterFrom === "right" ? 1 : -1;
    const reduced = prefersReducedMotion();
    card.style.transition = "none";
    card.style.transform = `translate3d(${direction * (window.innerWidth / 2 + card.offsetWidth)}px, 30px, 0) rotate(${reduced ? 0 : direction * 18}deg)`;
    void card.offsetWidth; // flush so the transition starts from off-screen
    card.style.transition = reduced ? "transform 120ms ease-out" : "transform 380ms cubic-bezier(0.2, 0.9, 0.3, 1.05)";
    card.style.transform = "";
    // Only on mount: a card that is already in place never re-enters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    drag.current.pointerId = null;
    drag.current.mode = "pending";
    drag.current.dragging = false;
    drag.current.samples = [];
    drag.current.scrollSamples = [];
    drag.current.scroller = null;
    drag.current.armed = null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active || busyRef.current || drag.current.pointerId !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-no-swipe]")) return;
    cancelAnimationFrame(inertiaFrame.current); // a touch stops a coasting scroll
    // Capture immediately, not once the drag is recognised: otherwise a
    // mouse released outside the card inside the slop radius is never seen,
    // and the stale gesture resumes on the next hover.
    event.currentTarget.setPointerCapture(event.pointerId);
    const scroller = mediaRef.current?.scroller() ?? null;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      mode: "pending",
      dragging: false,
      samples: [{ x: event.clientX, t: event.timeStamp }],
      scrollSamples: [{ x: event.clientY, t: event.timeStamp }],
      scroller,
      scrollStart: scroller?.scrollTop ?? 0,
      armed: null,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.mode === "pending") {
      if (Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return;
      onInteract();
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent: scroll a tall image, otherwise ignore the gesture.
        state.mode = state.scroller ? "scroll" : "ignore";
      } else {
        state.mode = "swipe";
        state.dragging = true;
      }
    }
    if (state.mode === "scroll" && state.scroller) {
      state.scroller.scrollTop = state.scrollStart - dy;
      state.scrollSamples.push({ x: event.clientY, t: event.timeStamp });
      if (state.scrollSamples.length > 8) state.scrollSamples.shift();
      return;
    }
    if (state.mode !== "swipe") return;
    state.dx = dx;
    state.dy = dy;
    state.samples.push({ x: event.clientX, t: event.timeStamp });
    if (state.samples.length > 8) state.samples.shift();
    applyDrag(dx, dy);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (event.pointerId !== state.pointerId) return;
    if (state.mode === "scroll" && state.scroller) {
      state.scrollSamples.push({ x: event.clientY, t: event.timeStamp });
      coast(state.scroller, releaseVelocity(state.scrollSamples));
    } else if (state.dragging) {
      state.samples.push({ x: event.clientX, t: event.timeStamp });
      const velocity = releaseVelocity(state.samples);
      const card = cardRef.current;
      const action = card ? resolveSwipe(state.dx, velocity, card.offsetWidth) : null;
      if (action) flyOut(action, velocity);
      else springBack();
    } else if (state.mode === "pending" && (event.target as HTMLElement).closest("[data-no-swipe]") === null) {
      // A tap (never left the slop radius): play/pause videos.
      onInteract();
      mediaRef.current?.togglePlay();
    }
    reset();
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== drag.current.pointerId) return;
    if (drag.current.dragging) springBack();
    reset();
  };

  // Capture can also end without pointerup/cancel (element hidden, window
  // blur); never leave a gesture half-open.
  const onLostPointerCapture = onPointerCancel;

  const isVideo = post.mimeType.startsWith("video/");
  const duration = isVideo ? formatDuration(post.duration) : null;
  const artistLine = post.artists.map(formatTagName).join(", ");
  const subjectLine = [...post.characters, ...post.copyrights].map(formatTagName).join(" · ");
  const label = artistLine ? `Post by ${artistLine}` : "Recommended post";

  return (
    <div
      ref={cardRef}
      role="group"
      aria-roledescription="card"
      aria-label={label}
      aria-hidden={!active}
      className={`absolute inset-0 select-none overflow-hidden rounded-3xl bg-zinc-900 shadow-xl ring-1 ring-black/10 will-change-transform dark:ring-white/10 ${
        active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      }`}
      // The card owns every touch gesture (swipe, tap, and tall-image scroll),
      // so the browser must never start a native pan or pinch on it.
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onDragStart={(event) => event.preventDefault()}
    >
      <SwipeMedia
        post={post}
        active={active}
        muted={muted}
        onToggleMute={onToggleMute}
        onAutoplayBlocked={onAutoplayBlocked}
        ref={mediaRef}
      />

      {/* Decision badges, faded in by drag progress. Same pill language as
          the favorite button: pink + solid heart for like, neutral for skip. */}
      <div
        ref={likeStampRef}
        aria-hidden
        className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg"
      >
        <HeartIcon className="h-4 w-4" />
        Like
      </div>
      <div
        ref={skipStampRef}
        aria-hidden
        className="pointer-events-none absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-zinc-800/90 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg ring-1 ring-white/10 backdrop-blur"
      >
        <XMarkIcon className="h-4 w-4" />
        Skip
      </div>

      {/* Caption */}
      {(artistLine || subjectLine || duration) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-16 text-white">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {artistLine && <p className="truncate text-lg font-semibold drop-shadow">{artistLine}</p>}
              {subjectLine && <p className="truncate text-sm text-white/80">{subjectLine}</p>}
            </div>
            {duration && (
              <span className="shrink-0 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                {duration}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
