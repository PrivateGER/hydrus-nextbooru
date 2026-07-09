/**
 * Shared meta tag utilities that can be used in both client and server components.
 * This module contains NO Prisma imports and is safe for browser use.
 *
 * @module lib/meta-tags-shared
 */

/**
 * Canonical name of the user "favorite" meta tag. Single source of the
 * literal so the meta-tag set and {@link isFavoriteTag} cannot drift.
 */
const FAVORITE_TAG_NAME = "favorite";

/**
 * List of all meta tag names.
 * Keep this in sync with the full definitions in meta-tags.ts
 */
const META_TAG_NAMES = new Set([
  "video",
  "animated",
  "portrait",
  "landscape",
  "square",
  "highres",
  "lowres",
  FAVORITE_TAG_NAME,
]);

/**
 * Check if a tag name is a meta tag.
 * Safe to use in client components.
 *
 * @param tagName - Tag name to check (case-insensitive)
 * @returns true if this is a recognized meta tag
 */
export function isMetaTag(tagName: string): boolean {
  return META_TAG_NAMES.has(tagName.toLowerCase());
}

/**
 * Whether a search token targets the favorite meta tag, ignoring an optional
 * leading "-" (exclusion) and case. Matches "favorite", "-favorite",
 * "FAVORITE", "-FAVORITE".
 */
export function isFavoriteTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  const bare = normalized.startsWith("-") ? normalized.slice(1) : normalized;
  return bare === FAVORITE_TAG_NAME;
}
