/**
 * Pure helpers for the group manga reader: page math, RTL-aware input
 * mapping, preload windows, and reading-progress (de)serialization.
 *
 * Kept free of React/Next/browser imports so everything is unit testable;
 * the reader component owns the actual localStorage/history side effects.
 */

export type FitMode = "contain" | "width" | "original";

const FIT_MODES: readonly FitMode[] = ["contain", "width", "original"];

export interface ReadingProgress {
  page: number;
  total: number;
  updatedAt: number;
}

/** Clamp a 1-based page number into [1, total]. */
export function clampPage(page: number, total: number): number {
  if (total < 1) return 1;
  return Math.min(Math.max(page, 1), total);
}

/**
 * Parse a raw page route segment. Returns null for anything that is not a
 * plain positive integer (out-of-range values are the caller's clamp job).
 */
export function parsePageParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const page = parseInt(raw, 10);
  return page >= 1 ? page : null;
}

/** Canonical reader URL for a group page. */
export function readerHref(groupId: number, page: number): string {
  return `/groups/${groupId}/read/${page}`;
}

/**
 * Map a screen-side input (tap zone or arrow key) to a paging direction.
 * In RTL (right-to-left manga) mode the left side advances forward.
 */
export function resolvePageAction(side: "left" | "right", rtl: boolean): "prev" | "next" {
  if (rtl) return side === "left" ? "next" : "prev";
  return side === "left" ? "prev" : "next";
}

/** Apply a paging direction; returns the same page at the ends. */
export function stepPage(page: number, total: number, action: "prev" | "next"): number {
  return clampPage(action === "next" ? page + 1 : page - 1, total);
}

/**
 * 1-based page numbers whose images should be preloaded around the current
 * page: `ahead` forward, `behind` backward, excluding the page itself.
 * Forward pages come first so they win when the browser rations requests.
 */
export function preloadTargets(
  page: number,
  total: number,
  ahead = 2,
  behind = 1
): number[] {
  const targets: number[] = [];
  for (let i = 1; i <= ahead; i++) {
    const p = page + i;
    if (p <= total) targets.push(p);
  }
  for (let i = 1; i <= behind; i++) {
    const p = page - i;
    if (p >= 1) targets.push(p);
  }
  return targets;
}

/** Next fit mode in the f-key cycle. */
export function nextFitMode(mode: FitMode): FitMode {
  const index = FIT_MODES.indexOf(mode);
  return FIT_MODES[(index + 1) % FIT_MODES.length];
}

export function progressKey(groupId: number): string {
  return `reader-progress:${groupId}`;
}

export function serializeProgress(progress: ReadingProgress): string {
  return JSON.stringify(progress);
}

/**
 * Parse stored reading progress. Returns null for malformed payloads or a
 * page that no longer fits the group (e.g. members were removed since).
 */
export function deserializeProgress(raw: string | null, total: number): ReadingProgress | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { page, total: storedTotal, updatedAt } = parsed as Record<string, unknown>;
    if (
      typeof page !== "number" ||
      !Number.isInteger(page) ||
      typeof storedTotal !== "number" ||
      typeof updatedAt !== "number"
    ) {
      return null;
    }
    if (page < 1 || page > total) return null;
    return { page, total: storedTotal, updatedAt };
  } catch {
    return null;
  }
}
