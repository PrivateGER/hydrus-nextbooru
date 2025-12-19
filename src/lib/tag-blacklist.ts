/**
 * Tag blacklist utility
 * Filters out tags matching configured patterns from appearing anywhere in the UI.
 * Supports wildcard patterns (e.g., "hydl-import-time:*")
 *
 * Configure via TAG_BLACKLIST environment variable (comma-separated patterns)
 * Example: TAG_BLACKLIST=hydl-import-time:*,system:*,private:*
 *
 * To hide posts containing specific tags, use HIDE_POSTS_WITH_TAGS (separate list)
 * Example: HIDE_POSTS_WITH_TAGS=nsfw,explicit,rating:explicit,private:*
 */

import { Prisma } from "@/generated/prisma/client";

// Parse blacklist patterns from environment variable
function getBlacklistPatterns(): string[] {
  const blacklist = "hydl-src-site:*,site:pixiv,hydl-sub-id:*,hydl-import-time:*,tweet id:*," + (process.env.TAG_BLACKLIST || "");
  if (!blacklist.trim()) return [];
  return blacklist.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
}

// Cache patterns for performance
let cachedPatterns: string[] | null = null;

function getPatterns(): string[] {
  if (cachedPatterns === null) {
    cachedPatterns = getBlacklistPatterns();
  }
  return cachedPatterns;
}

/**
 * Convert a wildcard pattern to a regex
 * Supports * as wildcard (matches any characters)
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // Convert * to .* for regex matching
  const regexPattern = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${regexPattern}$`, "i");
}

/**
 * Check if a tag matches any blacklist pattern
 */
export function isTagBlacklisted(tagName: string): boolean {
  const patterns = getPatterns();
  if (patterns.length === 0) return false;

  const normalizedTag = tagName.toLowerCase();

  return patterns.some(pattern => {
    if (pattern.includes("*")) {
      return patternToRegex(pattern).test(normalizedTag);
    }
    return normalizedTag === pattern;
  });
}

/**
 * Filter out blacklisted tags from an array (for in-memory filtering)
 */
export function filterBlacklistedTags<T extends { name: string }>(tags: T[]): T[] {
  const patterns = getPatterns();
  if (patterns.length === 0) return tags;

  return tags.filter(tag => !isTagBlacklisted(tag.name));
}

/**
 * Get Prisma AND conditions to exclude blacklisted tags
 * Returns an array of NOT conditions that can be spread into an AND clause
 */
export function getBlacklistNotConditions(): Prisma.TagWhereInput[] {
  const patterns = getPatterns();
  if (patterns.length === 0) return [];

  return patterns.map(pattern => {
    if (pattern.endsWith("*")) {
      // Prefix match - use startsWith
      return {
        NOT: {
          name: {
            startsWith: pattern.slice(0, -1), // Remove trailing *
            mode: "insensitive" as const,
          },
        },
      };
    } else {
      // Exact match
      return {
        NOT: {
          name: {
            equals: pattern,
            mode: "insensitive" as const,
          },
        },
      };
    }
  });
}

/**
 * Merge blacklist conditions into an existing Prisma where clause
 */
export function withBlacklistFilter(where: Prisma.TagWhereInput = {}): Prisma.TagWhereInput {
  const blacklistConditions = getBlacklistNotConditions();
  if (blacklistConditions.length === 0) return where;

  // Merge with existing AND conditions if present
  const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];

  return {
    ...where,
    AND: [...existingAnd, ...blacklistConditions],
  };
}

/**
 * Parse post hiding patterns from HIDE_POSTS_WITH_TAGS environment variable.
 * This is a separate list from TAG_BLACKLIST - posts containing any of these tags
 * will be completely hidden from all views.
 *
 * Example: HIDE_POSTS_WITH_TAGS=nsfw,explicit,rating:explicit
 */
function getPostHidingPatterns(): string[] {
  const patterns = process.env.HIDE_POSTS_WITH_TAGS || "";
  if (!patterns.trim()) return [];
  return patterns.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
}

// Cache post hiding patterns
let cachedPostHidingPatterns: string[] | null = null;

function getPostHidingPatternsWithCache(): string[] {
  if (cachedPostHidingPatterns === null) {
    cachedPostHidingPatterns = getPostHidingPatterns();
  }
  return cachedPostHidingPatterns;
}

/**
 * Check if post hiding is enabled (HIDE_POSTS_WITH_TAGS has patterns)
 */
export function hasPostHidingPatterns(): boolean {
  return getPostHidingPatternsWithCache().length > 0;
}

/**
 * Get Prisma WHERE conditions to exclude posts that have any tags matching
 * HIDE_POSTS_WITH_TAGS patterns.
 */
export function getPostHidingConditions(): Prisma.PostWhereInput[] {
  const patterns = getPostHidingPatternsWithCache();
  if (patterns.length === 0) return [];

  // Exclude posts that have ANY tag matching a hiding pattern
  return patterns.map(pattern => {
    if (pattern.endsWith("*")) {
      // Prefix match
      return {
        tags: {
          none: {
            tag: {
              name: {
                startsWith: pattern.slice(0, -1),
                mode: "insensitive" as const,
              },
            },
          },
        },
      };
    } else {
      // Exact match
      return {
        tags: {
          none: {
            tag: {
              name: {
                equals: pattern,
                mode: "insensitive" as const,
              },
            },
          },
        },
      };
    }
  });
}

/**
 * Merge post hiding conditions into an existing Prisma Post where clause.
 * Posts containing tags matching HIDE_POSTS_WITH_TAGS will be excluded.
 */
export function withPostHidingFilter(where: Prisma.PostWhereInput = {}): Prisma.PostWhereInput {
  const hidingConditions = getPostHidingConditions();
  if (hidingConditions.length === 0) return where;

  const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];

  return {
    ...where,
    AND: [...existingAnd, ...hidingConditions],
  };
}

/**
 * Generate SQL WHERE clause fragment for excluding posts with hidden tags.
 * For use with raw SQL queries.
 * Returns a Prisma.Sql object that can be interpolated into raw queries.
 *
 * @param postIdExpr - SQL expression for the post ID (default: '"Post".id')
 */
export function getPostHidingSqlCondition(postIdExpr: string = '"Post".id'): Prisma.Sql {
  const patterns = getPostHidingPatternsWithCache();
  if (patterns.length === 0) return Prisma.sql`TRUE`;

  // Build NOT EXISTS subquery to exclude posts with any hidden tag
  const conditions = patterns.map(pattern => {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return Prisma.sql`LOWER(t.name) LIKE ${prefix.toLowerCase() + '%'}`;
    } else {
      return Prisma.sql`LOWER(t.name) = ${pattern.toLowerCase()}`;
    }
  });

  // Combine all conditions with OR
  const combinedCondition = conditions.reduce((acc, cond, i) =>
    i === 0 ? cond : Prisma.sql`${acc} OR ${cond}`
  );

  // Use Prisma.raw for the post ID expression since it's a column reference, not user input
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = ${Prisma.raw(postIdExpr)}
    AND (${combinedCondition})
  )`;
}

/**
 * Clear cached patterns (useful for testing or when env changes)
 */
export function clearPatternCache(): void {
  cachedPatterns = null;
  cachedPostHidingPatterns = null;
}
