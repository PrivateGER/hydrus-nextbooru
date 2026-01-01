import { TagCategory } from "@/generated/prisma/client";

// Map Hydrus namespaces to booru tag categories
const NAMESPACE_TO_CATEGORY: Record<string, TagCategory> = {
  // Artist namespaces
  creator: TagCategory.ARTIST,
  artist: TagCategory.ARTIST,
  drawn_by: TagCategory.ARTIST,

  // Character namespaces
  character: TagCategory.CHARACTER,
  char: TagCategory.CHARACTER,
  person: TagCategory.CHARACTER,

  // Copyright/Series namespaces
  series: TagCategory.COPYRIGHT,
  copyright: TagCategory.COPYRIGHT,
  franchise: TagCategory.COPYRIGHT,
  parody: TagCategory.COPYRIGHT,

  // Meta namespaces
  meta: TagCategory.META,
  medium: TagCategory.META,
  rating: TagCategory.META,
  source: TagCategory.META,
};

export interface ParsedTag {
  namespace: string | null;
  name: string;
  category: TagCategory;
  originalTag: string;
}

/**
 * Parse a Hydrus tag into namespace and name, and determine its category
 */
export function parseTag(tag: string): ParsedTag {
  const colonIndex = tag.indexOf(":");

  if (colonIndex === -1) {
    // No namespace
    return {
      namespace: null,
      name: tag.trim(),
      category: TagCategory.GENERAL,
      originalTag: tag,
    };
  }

  const namespace = tag.substring(0, colonIndex).toLowerCase().trim();
  const name = tag.substring(colonIndex + 1).trim();

  // Look up the category from the namespace
  const category = NAMESPACE_TO_CATEGORY[namespace] || TagCategory.GENERAL;

  return {
    namespace,
    name,
    category,
    originalTag: tag,
  };
}

/**
 * Parse multiple tags and group by category
 */
export function parseTags(tags: string[]): ParsedTag[] {
  return tags.map(parseTag);
}

/**
 * Convert a parsed tag to a normalized format for database storage
 * The name stored in the database is the full tag without namespace for display,
 * but we keep the category separate for filtering
 */
export function normalizeTagForStorage(tag: ParsedTag): { name: string; category: TagCategory } {
  // For artist/character/copyright tags, we typically want to store just the name
  // without the namespace, since the category already captures that info
  // For general tags, we keep the original tag (which may have namespaces like "clothing:dress")
  if (tag.category !== TagCategory.GENERAL && tag.namespace) {
    return {
      name: tag.name,
      category: tag.category,
    };
  }

  // For general tags, keep the full original tag to preserve any sub-namespaces
  return {
    name: tag.originalTag,
    category: tag.category,
  };
}
