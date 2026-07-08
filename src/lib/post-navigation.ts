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
}

/**
 * Pick the group that owns arrow-key/swipe navigation on the post page.
 *
 * Priority:
 * 1. The group named by the URL's `?in=` param, when the post actually
 *    belongs to it and it has more than one member. This keeps navigation
 *    pinned to the group the user entered through, so arrows never silently
 *    switch groups mid-browse.
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
    const requested = candidates.find((g) => g.id === requestedGroupId);
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
