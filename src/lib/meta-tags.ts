/**
 * Virtual/computed meta tags based on file properties.
 *
 * Meta tags are not stored in the database - they're computed at query-time
 * from post metadata (mimeType, dimensions, etc.). This allows filtering
 * by file characteristics without syncing additional data from Hydrus.
 *
 * @module lib/meta-tags
 */

import { Prisma, Orientation } from "@/generated/prisma/client";

/**
 * Categories for meta tags to help with organization and display.
 */
export type MetaTagCategory = "type" | "orientation" | "resolution";

/**
 * Definition of a meta tag including its name, condition, and metadata.
 */
export interface MetaTagDefinition {
  /** The tag name users type to search (e.g., "video", "portrait") */
  name: string;
  /** Human-readable description for autocomplete/help */
  description: string;
  /** Category for grouping in UI */
  category: MetaTagCategory;
  /**
   * Returns Prisma WHERE condition for this meta tag.
   * Optional - orientation tags (portrait/landscape/square) use raw SQL instead
   * because Prisma doesn't support field-to-field comparison (height vs width).
   * Check requiresRawSql() before calling this.
   */
  getCondition?: () => Prisma.PostWhereInput;
  /**
   * Returns raw SQL condition for this meta tag.
   * All meta tags must implement this for use in raw SQL queries.
   * @param negated - Whether to negate the condition
   */
  getSqlCondition: (negated?: boolean) => Prisma.Sql;
}

/**
 * Registry of all available meta tags.
 *
 * Each meta tag maps to a Prisma condition that filters posts
 * based on their file properties.
 */
const META_TAG_DEFINITIONS: MetaTagDefinition[] = [
  // Media Type
  {
    name: "video",
    description: "Video files (mp4, webm, etc.)",
    category: "type",
    getCondition: () => ({
      mimeType: { startsWith: "video/" },
    }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`("mimeType" IS NULL OR "mimeType" NOT LIKE 'video/%')`
      : Prisma.sql`"mimeType" LIKE 'video/%'`,
  },
  {
    name: "animated",
    description: "Animated images (GIF, APNG)",
    category: "type",
    getCondition: () => ({
      mimeType: { in: ["image/gif", "image/apng"] },
    }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`("mimeType" IS NULL OR "mimeType" NOT IN ('image/gif', 'image/apng'))`
      : Prisma.sql`"mimeType" IN ('image/gif', 'image/apng')`,
  },

  // Orientation tags use the computed orientation column
  {
    name: "portrait",
    description: "Taller than wide",
    category: "orientation",
    getCondition: () => ({ orientation: Orientation.portrait }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`("orientation" IS NULL OR "orientation" != 'portrait')`
      : Prisma.sql`"orientation" = 'portrait'`,
  },
  {
    name: "landscape",
    description: "Wider than tall",
    category: "orientation",
    getCondition: () => ({ orientation: Orientation.landscape }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`("orientation" IS NULL OR "orientation" != 'landscape')`
      : Prisma.sql`"orientation" = 'landscape'`,
  },
  {
    name: "square",
    description: "Equal width and height",
    category: "orientation",
    getCondition: () => ({ orientation: Orientation.square }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`("orientation" IS NULL OR "orientation" != 'square')`
      : Prisma.sql`"orientation" = 'square'`,
  },

  // Resolution
  {
    name: "highres",
    description: "Full HD or higher (1920px+)",
    category: "resolution",
    getCondition: () => ({
      OR: [{ width: { gte: 1920 } }, { height: { gte: 1920 } }],
    }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`NOT ("width" >= 1920 OR "height" >= 1920)`
      : Prisma.sql`("width" >= 1920 OR "height" >= 1920)`,
  },
  {
    name: "lowres",
    description: "Low resolution (500px or less)",
    category: "resolution",
    getCondition: () => ({
      AND: [
        { width: { not: null } },
        { height: { not: null } },
        { width: { lte: 500 } },
        { height: { lte: 500 } },
      ],
    }),
    getSqlCondition: (negated = false) => negated
      ? Prisma.sql`NOT ("width" IS NOT NULL AND "height" IS NOT NULL AND "width" <= 500 AND "height" <= 500)`
      : Prisma.sql`("width" IS NOT NULL AND "height" IS NOT NULL AND "width" <= 500 AND "height" <= 500)`,
  },
];

/**
 * Map for O(1) lookup of meta tags by name (case-insensitive).
 */
const META_TAGS_BY_NAME = new Map<string, MetaTagDefinition>(
  META_TAG_DEFINITIONS.map((def) => [def.name.toLowerCase(), def])
);

/**
 * Check if a tag name is a meta tag.
 *
 * @param tagName - Tag name to check (case-insensitive)
 * @returns true if this is a recognized meta tag
 */
export function isMetaTag(tagName: string): boolean {
  return META_TAGS_BY_NAME.has(tagName.toLowerCase());
}

/**
 * Get the definition for a meta tag.
 *
 * @param tagName - Tag name (case-insensitive)
 * @returns The meta tag definition, or undefined if not a meta tag
 */
export function getMetaTagDefinition(
  tagName: string
): MetaTagDefinition | undefined {
  return META_TAGS_BY_NAME.get(tagName.toLowerCase());
}

/**
 * Get raw SQL condition for a meta tag.
 * Convenience function that looks up the tag and calls getSqlCondition().
 *
 * @param tagName - Tag name (case-insensitive)
 * @param negated - Whether to negate the condition (default: false)
 * @returns Prisma.Sql fragment for the condition, or null if not a meta tag
 */
export function getMetaTagSqlCondition(
  tagName: string,
  negated: boolean = false
): Prisma.Sql | null {
  const def = getMetaTagDefinition(tagName);
  if (!def) return null;
  return def.getSqlCondition(negated);
}

/**
 * Get all available meta tag definitions.
 *
 * @returns Array of all meta tag definitions
 */
export function getAllMetaTags(): MetaTagDefinition[] {
  return [...META_TAG_DEFINITIONS];
}

/**
 * Get meta tags that match a search query.
 *
 * @param query - Search query to match against tag names (case-insensitive)
 * @returns Array of matching meta tag definitions
 */
export function searchMetaTags(query: string): MetaTagDefinition[] {
  if (!query) {
    return [...META_TAG_DEFINITIONS];
  }
  const lowerQuery = query.toLowerCase();
  return META_TAG_DEFINITIONS.filter(
    (def) =>
      def.name.toLowerCase().includes(lowerQuery) ||
      def.description.toLowerCase().includes(lowerQuery)
  );
}


/**
 * Get the count of posts matching a meta tag, optionally filtered by tag co-occurrence.
 *
 * @param tagName - Meta tag name
 * @param prisma - Prisma client instance
 * @param filteredPostIds - Optional array of post IDs to restrict the count to (for co-occurrence)
 * @returns Number of matching posts
 */
export async function getMetaTagCount(
  tagName: string,
  prisma: {
    post: { count: (args: { where: Prisma.PostWhereInput }) => Promise<number> };
  },
  filteredPostIds?: number[]
): Promise<number> {
  const def = getMetaTagDefinition(tagName);
  if (!def?.getCondition) return 0;

  const where = filteredPostIds && filteredPostIds.length > 0
    ? { AND: [def.getCondition(), { id: { in: filteredPostIds } }] }
    : def.getCondition();

  return prisma.post.count({ where });
}

/**
 * Get counts for multiple meta tags in parallel, optionally filtered by tag co-occurrence.
 *
 * @param tagNames - Array of meta tag names
 * @param prisma - Prisma client instance
 * @param filteredPostIds - Optional array of post IDs to restrict counts to (for co-occurrence)
 * @returns Map of tag name to count
 */
export async function getMetaTagCounts(
  tagNames: string[],
  prisma: {
    post: { count: (args: { where: Prisma.PostWhereInput }) => Promise<number> };
  },
  filteredPostIds?: number[]
): Promise<Map<string, number>> {
  const counts = await Promise.all(
    tagNames.map(async (name) => [name, await getMetaTagCount(name, prisma, filteredPostIds)] as const)
  );
  return new Map(counts);
}

/**
 * Separate meta tags from regular tags in a list.
 *
 * @param tags - Array of tag names (may include negated tags with "-" prefix)
 * @returns Object with separated meta and regular tags, each split into include/exclude
 */
export function separateMetaTags(tags: string[]): {
  metaTags: { include: string[]; exclude: string[] };
  regularTags: { include: string[]; exclude: string[] };
} {
  const result = {
    metaTags: { include: [] as string[], exclude: [] as string[] },
    regularTags: { include: [] as string[], exclude: [] as string[] },
  };

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;

    const negated = trimmed.startsWith("-");
    const name = negated ? trimmed.slice(1) : trimmed;

    if (!name) continue;

    if (isMetaTag(name)) {
      if (negated) {
        result.metaTags.exclude.push(name);
      } else {
        result.metaTags.include.push(name);
      }
    } else {
      if (negated) {
        result.regularTags.exclude.push(name);
      } else {
        result.regularTags.include.push(name);
      }
    }
  }

  return result;
}
