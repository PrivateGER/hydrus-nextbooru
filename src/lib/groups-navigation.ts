/**
 * Pure URL-building helpers for client-side navigation on the groups page.
 *
 * Kept free of React/Next imports so the seed-handling logic can be unit tested
 * in isolation.
 */

/**
 * Generate an 8-character hex seed for random group ordering.
 *
 * Mirrors the server's seed format but avoids `crypto.randomUUID()`, which
 * throws outside secure contexts (e.g. the app served over plain HTTP).
 */
export function createGroupsSeed(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build the destination URL for a groups search/filter navigation.
 *
 * Starts from the current search params, applies the new text/creator filters,
 * resets pagination, and — critically — ensures random-order destinations carry
 * a seed.
 *
 * The groups page server-redirects random-order requests that lack a seed (to
 * stabilize ordering across pagination). That redirect is delivered as an RSC
 * redirect directive, which client-side (soft) navigation fails to commit:
 * `router.push` to such a URL fetches the redirect but never updates the view.
 * By carrying a seed ourselves the destination renders directly, so the
 * navigation completes. Existing seeds and non-random orders are preserved.
 *
 * @param currentParams - The current URL search params.
 * @param next - The new `query` and `creator` filter values.
 * @param generateSeed - Seed generator (injectable for deterministic tests).
 * @returns A `/groups` URL string safe for client-side navigation.
 */
export function buildGroupsSearchUrl(
  currentParams: { toString(): string },
  next: { query: string; creator: string },
  generateSeed: () => string = createGroupsSeed,
): string {
  const params = new URLSearchParams(currentParams.toString());
  const trimmedQuery = next.query.trim();
  const trimmedCreator = next.creator.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  } else {
    params.delete("q");
  }

  if (trimmedCreator) {
    params.set("creator", trimmedCreator);
  } else {
    params.delete("creator");
  }

  params.delete("page");

  const order = params.get("order") ?? "random";
  if (order === "random" && !params.get("seed")) {
    params.set("order", "random");
    params.set("seed", generateSeed());
  }

  const queryString = params.toString();
  return `/groups${queryString ? `?${queryString}` : ""}`;
}
