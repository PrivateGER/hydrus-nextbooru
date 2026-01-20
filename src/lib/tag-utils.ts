/**
 * Tag string manipulation utilities for search functionality.
 */

/**
 * Determine whether a tag string represents a negated tag.
 *
 * @returns `true` if the tag starts with `-` and has more than one character, `false` otherwise.
 */
export function isNegatedTag(tag: string): boolean {
  return tag.startsWith("-") && tag.length > 1;
}

/**
 * Determine whether a tag contains a wildcard pattern.
 *
 * @returns `true` if the tag (after stripping negation prefix) contains `*`
 */
export function isWildcardTag(tag: string): boolean {
  const baseTag = isNegatedTag(tag) ? tag.slice(1) : tag;
  return baseTag.includes("*");
}

/**
 * Return the tag name without a leading '-' negation prefix.
 *
 * @param tag - The tag string, possibly prefixed with `-` to indicate negation
 * @returns The tag name with the leading `-` removed if present
 */
export function getBaseTagName(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : tag;
}

/**
 * Flip a tag's negation state.
 *
 * @param tag - The tag string, which may start with `-` to indicate negation.
 * @returns The tag with negation toggled: if `tag` starts with `-` (and has more than one character) the leading `-` is removed; otherwise a leading `-` is added.
 */
export function toggleTagNegation(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : `-${tag}`;
}

/**
 * Check if a string is a valid SHA256 hash (64 hexadecimal characters).
 */
export function isValidSha256Hash(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value.trim());
}
