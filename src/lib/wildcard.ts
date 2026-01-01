/**
 * Wildcard pattern utilities for tag searches.
 *
 * Supports `*` as a wildcard character that matches any sequence of characters.
 * Examples:
 *   - `character:*` matches all character-namespaced tags
 *   - `*_eyes` matches tags ending with "_eyes"
 *   - `blue*` matches tags starting with "blue"
 */

import { prisma } from "@/lib/db";
import { wildcardPatternCache, type WildcardCacheEntry } from "@/lib/cache";
import { wildcardLog } from "@/lib/logger";

// Re-export for convenience
export type { WildcardCacheEntry } from "@/lib/cache";

/** Maximum number of tags a wildcard pattern can match */
export const WILDCARD_TAG_LIMIT = 500;

/** Minimum number of non-wildcard characters required */
const MIN_LITERAL_CHARS = 2;

/**
 * Check if a tag pattern contains wildcard characters.
 *
 * @param tag - The tag pattern to check (may include `-` prefix for negation)
 * @returns True if the pattern contains `*` wildcards
 */
export function isWildcardPattern(tag: string): boolean {
  // Strip negation prefix if present
  const pattern = tag.startsWith("-") && tag.length > 1 ? tag.slice(1) : tag;
  return pattern.includes("*");
}

/**
 * Get the base pattern from a potentially negated tag.
 *
 * @param tag - Tag pattern that may start with `-` for negation
 * @returns The pattern without the negation prefix
 */
function getBasePattern(tag: string): string {
  return tag.startsWith("-") && tag.length > 1 ? tag.slice(1) : tag;
}

/**
 * Check if a tag is negated (starts with `-`).
 *
 * @param tag - The tag to check
 * @returns True if the tag is negated
 */
function isNegatedPattern(tag: string): boolean {
  return tag.startsWith("-") && tag.length > 1;
}

/**
 * Convert a user wildcard pattern (`*`) to a SQL LIKE pattern (`%`).
 *
 * Escapes SQL special characters (`%`, `_`, `\`) before converting
 * the user-facing `*` wildcard to the SQL `%` wildcard.
 *
 * @param pattern - The user wildcard pattern (without negation prefix)
 * @returns The SQL LIKE pattern
 */
function wildcardToSqlPattern(pattern: string): string {
  // First escape SQL LIKE special characters (%, _, \)
  const escaped = pattern.replace(/[\\%_]/g, "\\$&");
  // Then convert user wildcards (*) to SQL wildcards (%)
  return escaped.replace(/\*/g, "%");
}

/**
 * Validate that a wildcard pattern is safe to execute.
 *
 * Rejects patterns that are too broad:
 * - Standalone `*` (matches everything)
 * - `-*` (exclude everything)
 * - Patterns with fewer than 2 non-wildcard characters
 *
 * @param tag - The tag pattern to validate (may include `-` prefix)
 * @returns Validation result with error message if invalid
 */
export function validateWildcardPattern(tag: string): {
  valid: boolean;
  error?: string;
} {
  const pattern = getBasePattern(tag);
  const isNegated = isNegatedPattern(tag);

  // Reject standalone wildcard
  if (pattern === "*") {
    return {
      valid: false,
      error: isNegated
        ? "Cannot exclude all tags with '-*'"
        : "Standalone '*' is too broad. Add more characters to narrow the search.",
    };
  }

  // Reject pattern that's only wildcards
  const withoutWildcards = pattern.replace(/\*/g, "");
  if (withoutWildcards.length === 0) {
    return {
      valid: false,
      error: "Pattern must contain at least some non-wildcard characters.",
    };
  }

  // Require minimum literal characters
  if (withoutWildcards.length < MIN_LITERAL_CHARS) {
    return {
      valid: false,
      error: `Pattern must contain at least ${MIN_LITERAL_CHARS} non-wildcard characters.`,
    };
  }

  return { valid: true };
}

/**
 * Parse a list of tags into regular tags and wildcard patterns.
 *
 * @param tags - Array of tag patterns
 * @returns Object with regular tags and wildcard patterns separated
 */
function separateWildcardPatterns(tags: string[]): {
  regularTags: string[];
  wildcardPatterns: string[];
} {
  const regularTags: string[] = [];
  const wildcardPatterns: string[] = [];

  for (const tag of tags) {
    if (isWildcardPattern(tag)) {
      wildcardPatterns.push(tag);
    } else {
      regularTags.push(tag);
    }
  }

  return { regularTags, wildcardPatterns };
}

/**
 * Information about a resolved wildcard pattern.
 */
export interface ResolvedWildcard {
  /** The original wildcard pattern (may include `-` prefix) */
  pattern: string;
  /** Whether this is an exclusion pattern */
  negated: boolean;
  /** Matched tag IDs */
  tagIds: number[];
  /** Matched tag names (for UI display) */
  tagNames: string[];
  /** Matched tag categories (for UI display) */
  tagCategories: string[];
  /** Whether the result was truncated due to limit */
  truncated: boolean;
}

/**
 * Resolve a wildcard pattern to matching tags.
 * Results are cached for 5 minutes.
 *
 * @param pattern - The wildcard pattern (without negation prefix)
 * @param source - Optional source identifier for logging
 * @returns Cached entry with matching tag IDs, names, categories, and truncation status
 */
export async function resolveWildcardPattern(
  pattern: string,
  source?: string
): Promise<WildcardCacheEntry> {
  const cached = wildcardPatternCache.get(pattern);
  if (cached) {
    wildcardLog.debug({ pattern, count: cached.tagNames.length, source }, "Cache HIT");
    return cached;
  }

  // Convert to SQL LIKE pattern and use raw SQL for accurate wildcard matching
  const sqlPattern = wildcardToSqlPattern(pattern);
  wildcardLog.debug({ pattern, sqlPattern, source }, "Cache MISS, querying");

  const matchingTags = await prisma.$queryRaw<Array<{ id: number; name: string; category: string }>>`
    SELECT id, name, category FROM "Tag"
    WHERE name ILIKE ${sqlPattern}
    ORDER BY "postCount" DESC
    LIMIT ${WILDCARD_TAG_LIMIT + 1}
  `;

  wildcardLog.debug(
    { pattern, count: matchingTags.length, sample: matchingTags.slice(0, 10).map(t => t.name), source },
    "Resolved wildcard"
  );

  const truncated = matchingTags.length > WILDCARD_TAG_LIMIT;
  const limitedTags = matchingTags.slice(0, WILDCARD_TAG_LIMIT);
  const result: WildcardCacheEntry = {
    tagIds: limitedTags.map((t) => t.id),
    tagNames: limitedTags.map((t) => t.name),
    tagCategories: limitedTags.map((t) => t.category),
    truncated,
  };

  wildcardPatternCache.set(pattern, result);
  return result;
}

/**
 * Split tag strings into included and excluded lists.
 *
 * Tags that start with `-` and have more than one character are placed in `excludeTags`
 * with the leading `-` removed; all other tags are placed in `includeTags`.
 *
 * @param tags - Array of tag strings to parse
 * @returns An object containing `includeTags` and `excludeTags` arrays
 */
function parseTagsWithNegation(tags: string[]): {
  includeTags: string[];
  excludeTags: string[];
} {
  const includeTags: string[] = [];
  const excludeTags: string[] = [];

  for (const tag of tags) {
    if (tag.startsWith("-") && tag.length > 1) {
      excludeTags.push(tag.slice(1));
    } else {
      includeTags.push(tag);
    }
  }

  return { includeTags, excludeTags };
}

/**
 * Parse a comma-separated tag string into included and excluded tag lists.
 *
 * Leading/trailing whitespace is trimmed and tags are lowercased; empty entries are ignored.
 *
 * @param tagsParam - Comma-separated tags where tags prefixed with `-` denote exclusion
 * @returns An object with `includeTags` (tags to include) and `excludeTags` (tags to exclude)
 */
export function parseTagsParamWithNegation(tagsParam: string): {
  includeTags: string[];
  excludeTags: string[];
} {
  const allTags = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  return parseTagsWithNegation(allTags);
}
