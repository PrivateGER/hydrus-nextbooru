/**
 * Minimal post data needed to render a thumbnail card and link.
 *
 * This is the shared base for the post shapes passed between search/feed
 * queries and grid/card components. Extend it (e.g. with `distance`,
 * `favorited`, `extension`) rather than redeclaring the core fields.
 */
export interface PostSummary {
  id?: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}
