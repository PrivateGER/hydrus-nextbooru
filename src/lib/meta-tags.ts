/**
 * Virtual/computed meta tags based on file properties.
 *
 * Meta tags are not stored in the database - they're computed at query-time
 * from post metadata (mimeType, dimensions, etc.). This allows filtering
 * by file characteristics without syncing additional data from Hydrus.
 *
 * @module lib/meta-tags
 */

import { Prisma } from "@/generated/prisma/client";

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
  },
  {
    name: "animated",
    description: "Animated images (GIF, APNG)",
    category: "type",
    getCondition: () => ({
      mimeType: { in: ["image/gif", "image/apng"] },
    }),
  },

  // Orientation tags use raw SQL via getOrientationSqlCondition() - no Prisma condition needed
  { name: "portrait", description: "Taller than wide", category: "orientation" },
  { name: "landscape", description: "Wider than tall", category: "orientation" },
  { name: "square", description: "Equal width and height", category: "orientation" },

  // Resolution
  {
    name: "highres",
    description: "Full HD or higher (1920px+)",
    category: "resolution",
    getCondition: () => ({
      OR: [{ width: { gte: 1920 } }, { height: { gte: 1920 } }],
    }),
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
 * Orientation meta tags that require raw SQL for field-to-field comparison.
 * Prisma doesn't support comparing two columns directly in WHERE clauses.
 */
const ORIENTATION_TAGS = new Set(["portrait", "landscape", "square"]);

/**
 * Check if a meta tag requires raw SQL for its condition.
 *
 * @param tagName - Tag name (case-insensitive)
 * @returns true if this meta tag needs raw SQL handling
 */
export function requiresRawSql(tagName: string): boolean {
  return ORIENTATION_TAGS.has(tagName.toLowerCase());
}

/**
 * Get raw SQL condition for orientation meta tags.
 *
 * @param tagName - Tag name (case-insensitive)
 * @param negated - Whether to negate the condition
 * @returns Prisma.Sql fragment for the condition
 */
export function getOrientationSqlCondition(
  tagName: string,
  negated: boolean = false
): Prisma.Sql {
  const name = tagName.toLowerCase();
  const nullCheck = Prisma.sql`"width" IS NOT NULL AND "height" IS NOT NULL`;

  let condition: Prisma.Sql;
  switch (name) {
    case "portrait":
      condition = Prisma.sql`(${nullCheck} AND "height" > "width")`;
      break;
    case "landscape":
      condition = Prisma.sql`(${nullCheck} AND "width" > "height")`;
      break;
    case "square":
      condition = Prisma.sql`(${nullCheck} AND "width" = "height")`;
      break;
    default:
      throw new Error(`Unknown orientation tag: ${tagName}`);
  }

  return negated ? Prisma.sql`NOT ${condition}` : condition;
}

/**
 * Get the count of posts matching a meta tag, optionally filtered by tag co-occurrence.
 * Uses raw SQL for orientation tags, Prisma for others.
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
    $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  },
  filteredPostIds?: number[]
): Promise<number> {
  const def = getMetaTagDefinition(tagName);
  if (!def) return 0;

  if (requiresRawSql(tagName)) {
    const condition = getOrientationSqlCondition(tagName, false);
    if (filteredPostIds && filteredPostIds.length > 0) {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM "Post"
        WHERE ${condition} AND id = ANY(${filteredPostIds}::int[])
      `;
      return Number(result[0]?.count ?? 0);
    }
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "Post" WHERE ${condition}
    `;
    return Number(result[0]?.count ?? 0);
  }

  // Non-orientation tags should always have getCondition defined
  if (!def.getCondition) return 0;

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
    $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
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
