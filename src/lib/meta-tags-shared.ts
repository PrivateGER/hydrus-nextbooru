/**
 * Shared meta tag utilities that can be used in both client and server components.
 * This module contains NO Prisma imports and is safe for browser use.
 *
 * @module lib/meta-tags-shared
 */

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
