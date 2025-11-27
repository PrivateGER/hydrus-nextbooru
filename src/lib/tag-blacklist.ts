/**
 * Tag blacklist utility
 * Filters out tags matching configured patterns from appearing anywhere in the UI.
 * Supports wildcard patterns (e.g., "hydl-import-time:*")
 *
 * Configure via TAG_BLACKLIST environment variable (comma-separated patterns)
 * Example: TAG_BLACKLIST=hydl-import-time:*,system:*,private:*
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
 * Clear cached patterns (useful for testing or when env changes)
 */
export function clearPatternCache(): void {
  cachedPatterns = null;
}
