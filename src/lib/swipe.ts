/**
 * Pure helpers for the swipe feed (/recommended/swipe): gesture resolution,
 * media fit, display formatting, and the device-local swipe history.
 *
 * Kept free of React and DOM access so they are unit-testable and shared by
 * the deck and card components.
 */

export type SwipeAction = "like" | "skip";

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------

/** Fraction of the card width a drag must travel to commit on release. */
export const SWIPE_DISTANCE_RATIO = 0.28;
/** Distance threshold clamps so tiny and huge cards still feel natural. */
export const SWIPE_MIN_THRESHOLD_PX = 72;
export const SWIPE_MAX_THRESHOLD_PX = 160;
/** A release faster than this (px/ms) commits even below the distance threshold. */
export const FLICK_VELOCITY = 0.5;
/** A flick still has to travel this far, so a twitchy tap never commits. */
export const FLICK_MIN_DISTANCE_PX = 24;
/** Movement before a pointer is treated as a drag rather than a tap. */
export const DRAG_SLOP_PX = 8;
/** Maximum card tilt, in degrees, at one card-width of travel. */
export const MAX_ROTATION_DEG = 14;

export function swipeThreshold(cardWidth: number): number {
  return Math.min(
    SWIPE_MAX_THRESHOLD_PX,
    Math.max(SWIPE_MIN_THRESHOLD_PX, cardWidth * SWIPE_DISTANCE_RATIO)
  );
}

/**
 * Decide what a released drag means. Right is like, left is skip (Tinder's
 * mapping). Returns null to spring the card back.
 *
 * @param dx - horizontal travel in px (positive = right)
 * @param velocityX - release velocity in px/ms (positive = right)
 * @param cardWidth - width of the card in px
 */
export function resolveSwipe(dx: number, velocityX: number, cardWidth: number): SwipeAction | null {
  if (!Number.isFinite(dx) || !Number.isFinite(velocityX)) return null;
  const threshold = swipeThreshold(cardWidth);
  if (Math.abs(dx) >= threshold) return dx > 0 ? "like" : "skip";
  const flicked =
    Math.abs(velocityX) >= FLICK_VELOCITY &&
    Math.abs(dx) >= FLICK_MIN_DISTANCE_PX &&
    Math.sign(velocityX) === Math.sign(dx);
  if (flicked) return dx > 0 ? "like" : "skip";
  return null;
}

/** 0 at rest, 1 once the drag reaches the commit threshold. */
export function swipeProgress(dx: number, cardWidth: number): number {
  return Math.min(1, Math.abs(dx) / swipeThreshold(cardWidth));
}

/** Tilt in degrees that follows the finger, clamped to ±MAX_ROTATION_DEG. */
export function dragRotation(dx: number, cardWidth: number): number {
  if (cardWidth <= 0) return 0;
  const rotation = (dx / cardWidth) * MAX_ROTATION_DEG;
  return Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, rotation));
}

/**
 * Release velocity from recent pointer samples (px/ms). Uses the span of
 * samples within `windowMs` of the last one, so a pause before release reads
 * as zero velocity instead of the speed of an earlier fling.
 */
export function releaseVelocity(
  samples: readonly { x: number; t: number }[],
  windowMs = 100
): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

// ---------------------------------------------------------------------------
// Media fit
// ---------------------------------------------------------------------------

export type FitMode = "contain" | "scroll";

/** Images at least this many times taller than wide may scroll instead of shrink. */
export const TALL_ASPECT = 2.2;
/** ...but only when fitting them would use less than this share of the card width. */
export const TALL_MIN_WIDTH_SHARE = 0.55;

/**
 * How a still image should sit in a card of `boxWidth` x `boxHeight`.
 *
 * Most media is letterboxed whole ("contain") over a blurred backdrop. Very
 * tall images (webtoon strips, long screenshots) would shrink to a sliver, so
 * they render at full card width and scroll vertically ("scroll"); vertical
 * scrolling does not conflict with the horizontal swipe gesture. Wide
 * panoramas always contain: horizontal scrolling would fight the swipe.
 */
export function fitMode(
  mediaWidth: number | null,
  mediaHeight: number | null,
  boxWidth: number,
  boxHeight: number
): FitMode {
  if (!mediaWidth || !mediaHeight || boxWidth <= 0 || boxHeight <= 0) return "contain";
  const aspect = mediaHeight / mediaWidth;
  if (aspect < TALL_ASPECT) return "contain";
  const containedWidth = Math.min(boxWidth, boxHeight / aspect);
  return containedWidth / boxWidth < TALL_MIN_WIDTH_SHARE ? "scroll" : "contain";
}

// ---------------------------------------------------------------------------
// Preloading
// ---------------------------------------------------------------------------

/** Same vocabulary as the `<video preload>` attribute. */
export type MediaPreload = "auto" | "metadata" | "none";

/**
 * How eagerly the card at `index` in the rendered stack (0 = top) loads its
 * media. `auto` loads the full file (a video buffers ahead so it plays the
 * moment it reaches the top), `metadata` only what a still needs (a video's
 * first frame; an image's preview thumbnail), `none` nothing beyond the
 * thumbnail.
 *
 * Cards load in order: a card buffers fully only once every card above it
 * has its media up (`readyAbove`), so preloading never slows down what the
 * user is looking at. Data Saver keeps it to the next card's still.
 */
export function stackPreload(index: number, readyAbove: boolean, saveData: boolean): MediaPreload {
  if (index <= 0) return "auto";
  if (readyAbove && !saveData) return "auto";
  return index === 1 ? "metadata" : "none";
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "m:ss" (or "h:mm:ss") for a video duration in milliseconds. */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

export function formatTagName(name: string): string {
  return name.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Device-local swipe history
// ---------------------------------------------------------------------------

/**
 * A skip is "next", not "not interested": the server records that the card was
 * shown and skipped, but never ranks a post lower for it. So the device
 * remembers what it has swiped to avoid re-dealing the same cards. Entries
 * expire so skipped posts can resurface later; likes become favorites and
 * drop out of the server ranking on their own.
 */
export interface SwipeHistoryEntry {
  hash: string;
  action: SwipeAction;
  /** Epoch ms of the swipe. */
  at: number;
}

export const SWIPE_HISTORY_KEY = "swipe-feed-history-v1";
export const SWIPE_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SWIPE_HISTORY_MAX = 1000;

const HASH_PATTERN = /^[a-f0-9]{64}$/;

/** Drop expired entries and keep only the newest SWIPE_HISTORY_MAX. Oldest first. */
export function pruneHistory(
  entries: readonly SwipeHistoryEntry[],
  now: number
): SwipeHistoryEntry[] {
  const fresh = entries.filter((entry) => now - entry.at < SWIPE_HISTORY_TTL_MS && entry.at <= now + 60_000);
  return fresh.slice(Math.max(0, fresh.length - SWIPE_HISTORY_MAX));
}

/** Parse stored history, discarding anything malformed. Never throws. */
export function parseHistory(raw: string | null, now: number): SwipeHistoryEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const entries: SwipeHistoryEntry[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const { hash, action, at } = item as Record<string, unknown>;
    if (typeof hash !== "string" || !HASH_PATTERN.test(hash)) continue;
    if (action !== "like" && action !== "skip") continue;
    if (typeof at !== "number" || !Number.isFinite(at)) continue;
    entries.push({ hash, action, at });
  }
  entries.sort((a, b) => a.at - b.at);
  return pruneHistory(entries, now);
}

/** Record a swipe, replacing any earlier entry for the same hash. */
export function recordSwipe(
  entries: readonly SwipeHistoryEntry[],
  entry: SwipeHistoryEntry,
  now: number
): SwipeHistoryEntry[] {
  return pruneHistory([...entries.filter((e) => e.hash !== entry.hash), entry], now);
}

/** Forget a swipe (undo). */
export function removeSwipe(entries: readonly SwipeHistoryEntry[], hash: string): SwipeHistoryEntry[] {
  return entries.filter((entry) => entry.hash !== hash);
}
