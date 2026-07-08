import { SourceType } from "@/generated/prisma/enums";

/**
 * Pure helpers deciding which group the post page's prev/next navigation
 * follows, and building post URLs that carry that group context.
 *
 * Kept free of React/Next imports so the selection logic can be unit tested
 * in isolation (same pattern as groups-navigation.ts).
 */

interface NavigationGroupShape {
  id: number;
  sourceType: SourceType;
  posts: Array<{ post: { hash: string } }>;
  /** Ids of order-identical groups this one absorbed during filmstrip dedupe. */
  duplicateGroupIds?: number[];
}

/**
 * Pick the group that owns arrow-key/swipe navigation on the post page.
 *
 * Priority:
 * 1. The group named by the URL's `?in=` param, when the post actually
 *    belongs to it and it has more than one member. This keeps navigation
 *    pinned to the group the user entered through, so arrows never silently
 *    switch groups mid-browse. A group absorbed during filmstrip dedupe
 *    resolves to its survivor, which orders the same posts identically.
 * 2. Otherwise the "best" multi-post group by a deterministic ranking:
 *    non-TITLE source groups first (they carry the canonical source
 *    ordering), then larger groups, then lowest id as a stable tiebreak.
 *
 * Returns undefined when the post is in no multi-post group.
 */
export function selectNavigationGroup<G extends NavigationGroupShape>(
  groups: G[],
  requestedGroupId?: number
): G | undefined {
  const candidates = groups.filter((g) => g.posts.length > 1);
  if (candidates.length === 0) return undefined;

  if (requestedGroupId !== undefined) {
    const requested = candidates.find(
      (g) => g.id === requestedGroupId || g.duplicateGroupIds?.includes(requestedGroupId)
    );
    if (requested) return requested;
  }

  return candidates.reduce((best, g) => {
    const bestIsTitle = best.sourceType === SourceType.TITLE;
    const gIsTitle = g.sourceType === SourceType.TITLE;
    if (bestIsTitle !== gIsTitle) return bestIsTitle ? g : best;
    if (g.posts.length !== best.posts.length) {
      return g.posts.length > best.posts.length ? g : best;
    }
    return g.id < best.id ? g : best;
  });
}

/**
 * Build a post URL, optionally carrying the active navigation group as
 * `?in=<groupId>` so the destination keeps following the same group.
 */
export function buildPostUrl(hash: string, groupId?: number): string {
  return groupId !== undefined ? `/post/${hash}?in=${groupId}` : `/post/${hash}`;
}

/**
 * Parse the `?in=` search param into a group id. Returns undefined for
 * missing, repeated, or non-numeric values.
 */
export function parseGroupIdParam(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * A search listing the user navigated in from. Carried on post URLs as
 * `?ctx=search&tags=<comma-list>[&page=N]` so prev/next can follow the
 * search results instead of a group. Takes precedence over `?in=` group
 * context.
 */
export interface SearchContext {
  tags: string[];
  /**
   * 1-based listing page the user entered from, kept only so "back to
   * results" returns there. Navigation itself is keyset-based and page-free;
   * omitted when the listing was on page 1.
   */
  page?: number;
}

/**
 * Parse `?ctx=` + `?tags=` (+ optional `?page=`) search params into a
 * SearchContext. Tag normalization mirrors the search page's own parsing.
 */
export function parseSearchContext(
  ctx: string | string[] | undefined,
  tags: string | string[] | undefined,
  page?: string | string[] | undefined
): SearchContext | undefined {
  if (ctx !== "search" || typeof tags !== "string") return undefined;
  const parsed = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (parsed.length === 0) return undefined;

  const parsedPage = typeof page === "string" ? Number(page) : undefined;
  const validPage =
    parsedPage !== undefined && Number.isInteger(parsedPage) && parsedPage > 1
      ? parsedPage
      : undefined;

  return { tags: parsed, ...(validPage !== undefined && { page: validPage }) };
}

/**
 * Encode a SearchContext as a URL query string (no leading `?`), for
 * appending to post links from search listings.
 */
export function searchContextQuery(context: SearchContext): string {
  const params = new URLSearchParams({ ctx: "search", tags: context.tags.join(",") });
  if (context.page !== undefined && context.page > 1) {
    params.set("page", String(context.page));
  }
  return params.toString();
}

/** Build a post URL that carries search-listing navigation context. */
export function buildSearchPostUrl(hash: string, context: SearchContext): string {
  return `/post/${hash}?${searchContextQuery(context)}`;
}

/** The search listing URL a search context came from (for "back to results"). */
export function searchContextBackUrl(context: SearchContext): string {
  const page = context.page !== undefined && context.page > 1 ? `&page=${context.page}` : "";
  return `/search?tags=${encodeURIComponent(context.tags.join(","))}${page}`;
}

export type GallerySort = "newest" | "oldest" | "random";

/**
 * The gallery listing the user navigated in from, carried on post URLs as
 * `?ctx=gallery[&sort=...][&seed=...][&page=N]`. All three gallery sorts are
 * deterministic (newest/oldest by import time; random is a seeded hash
 * rotation), so prev/next replay server-side just like search contexts.
 * Precedence sits alongside search context, above `?in=` group context.
 */
export interface GalleryContext {
  sort: GallerySort;
  /** Rotation seed; present exactly when sort is "random". */
  seed?: string;
  /** 1-based listing page for "back to gallery" (omitted when 1). */
  page?: number;
}

/** Mirrors the home page's seed validation. */
const GALLERY_SEED_PATTERN = /^[a-z0-9]{8}$/;

/**
 * Parse `?ctx=gallery` params into a GalleryContext. Random sort without a
 * valid seed cannot be replayed, so it yields no context (group fallback).
 */
export function parseGalleryContext(
  ctx: string | string[] | undefined,
  sort: string | string[] | undefined,
  seed: string | string[] | undefined,
  page?: string | string[] | undefined
): GalleryContext | undefined {
  if (ctx !== "gallery") return undefined;

  const parsedSort: GallerySort = sort === "oldest" || sort === "random" ? sort : "newest";
  const validSeed =
    typeof seed === "string" && GALLERY_SEED_PATTERN.test(seed) ? seed : undefined;
  if (parsedSort === "random" && validSeed === undefined) return undefined;

  const parsedPage = typeof page === "string" ? Number(page) : undefined;
  const validPage =
    parsedPage !== undefined && Number.isInteger(parsedPage) && parsedPage > 1
      ? parsedPage
      : undefined;

  return {
    sort: parsedSort,
    ...(parsedSort === "random" && { seed: validSeed }),
    ...(validPage !== undefined && { page: validPage }),
  };
}

/**
 * Encode a GalleryContext as a URL query string (no leading `?`), for
 * appending to post links from the gallery. Defaults (newest, page 1) are
 * omitted so the plain gallery yields just `ctx=gallery`.
 */
export function galleryContextQuery(context: GalleryContext): string {
  const params = new URLSearchParams({ ctx: "gallery" });
  if (context.sort !== "newest") params.set("sort", context.sort);
  if (context.sort === "random" && context.seed) params.set("seed", context.seed);
  if (context.page !== undefined && context.page > 1) params.set("page", String(context.page));
  return params.toString();
}

/** Build a post URL that carries gallery-listing navigation context. */
export function buildGalleryPostUrl(hash: string, context: GalleryContext): string {
  return `/post/${hash}?${galleryContextQuery(context)}`;
}

/** The gallery URL a gallery context came from (for "back to gallery"). */
export function galleryContextBackUrl(context: GalleryContext): string {
  const params = new URLSearchParams();
  if (context.sort !== "newest") params.set("sort", context.sort);
  if (context.page !== undefined && context.page > 1) params.set("page", String(context.page));
  if (context.sort === "random" && context.seed) params.set("seed", context.seed);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
