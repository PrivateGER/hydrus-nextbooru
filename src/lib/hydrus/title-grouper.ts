import { createHash } from "crypto";
import { SourceType } from "@/generated/prisma/client";
import type { HydrusFileMetadata } from "./types";

const MAX_TITLE_SOURCE_ID_BYTES = 240;
const HASHED_TITLE_SOURCE_ID_PREFIX = "title-sha256:";

export interface TitleGroup {
  sourceType: typeof SourceType.TITLE;
  sourceId: string; // Lowercased normalized title, or a bounded SHA-256 key for very long titles.
  normalizedTitle: string;
  position: number;
}

// Patterns that indicate page numbering at the end of a title
const PAGE_NUMBER_PATTERNS: RegExp[] = [
  // Fraction format: "7/10", "1/5"
  /\s*\d+\s*\/\s*\d+\s*$/,
  // Parentheses: "(1)", "(01)", "( 2 )"
  /\s*\(\s*\d+\s*\)\s*$/,
  // Brackets: "[1]", "[01]"
  /\s*\[\s*\d+\s*\]\s*$/,
  // Suffix with separator: "- 1", "_ 02"
  /\s*[-_]\s*\d+\s*$/i,
  // Common sequence words: part, page, chapter, volume, episode, etc.
  /\s+(?:part|page|p|pg|no|#|chapter|chap|ch|volume|vol|v|episode|ep|e)\s*\.?\s*\d+\s*$/i,
  // Separator + sequence word: "- Part 1", "- Chapter 2"
  /\s*[-_]\s*(?:part|page|p|pg|no|#|chapter|chap|ch|volume|vol|v|episode|ep|e)\s*\.?\s*\d+\s*$/i,
  // Trailing digits with space: "Title 01", "Title 1"
  /\s+0*\d{1,3}\s*$/,
  // Common Japanese page indicators: "その1", "第1話"
  /\s*(?:その|第)\s*\d+\s*(?:話|章|部)?\s*$/,
];

// Patterns to extract the page number from the end
const PAGE_NUMBER_EXTRACTORS: { pattern: RegExp; group: number }[] = [
  { pattern: /(\d+)\s*\/\s*\d+\s*$/, group: 1 }, // "7/10" -> 7
  { pattern: /\(\s*(\d+)\s*\)\s*$/, group: 1 }, // "(1)" -> 1
  { pattern: /\[\s*(\d+)\s*\]\s*$/, group: 1 }, // "[1]" -> 1
  { pattern: /[-_]\s*(?:part|page|p|pg|no|#|chapter|chap|ch|volume|vol|v|episode|ep|e)\s*\.?\s*(\d+)\s*$/i, group: 1 }, // "- Chapter 1" -> 1
  { pattern: /(?:part|page|p|pg|no|#|chapter|chap|ch|volume|vol|v|episode|ep|e)\s*\.?\s*(\d+)\s*$/i, group: 1 }, // "chapter 3" -> 3
  { pattern: /[-_]\s*(\d+)\s*$/, group: 1 }, // "- 1" -> 1
  { pattern: /\s+0*(\d{1,3})\s*$/, group: 1 }, // "Title 01" -> 1
  { pattern: /(?:その|第)\s*(\d+)/, group: 1 }, // "その1" -> 1
];

/**
 * Extract title tags from Hydrus metadata.
 * Returns all `title:` namespaced tags.
 */
function extractTitleTags(metadata: HydrusFileMetadata): string[] {
  const titles: string[] = [];

  if (!metadata.tags || typeof metadata.tags !== "object") {
    return titles;
  }

  for (const serviceTags of Object.values(metadata.tags)) {
    if (!serviceTags?.display_tags) continue;

    const currentTags = serviceTags.display_tags["0"];
    if (!Array.isArray(currentTags)) continue;

    for (const tag of currentTags) {
      if (typeof tag !== "string") continue;

      // Match title: namespace (case insensitive)
      if (tag.toLowerCase().startsWith("title:")) {
        const title = tag.substring(6).trim();
        if (title) {
          titles.push(title);
        }
      }
    }
  }

  return titles;
}

/**
 * Extract page number from Hydrus metadata.
 * Looks for `page:` namespaced tags.
 * Returns the page number (1-indexed as tagged) or 0 if not found.
 */
function extractPageNumber(metadata: HydrusFileMetadata): number {
  if (!metadata.tags || typeof metadata.tags !== "object") {
    return 0;
  }

  for (const serviceTags of Object.values(metadata.tags)) {
    if (!serviceTags?.display_tags) continue;

    const currentTags = serviceTags.display_tags["0"];
    if (!Array.isArray(currentTags)) continue;

    for (const tag of currentTags) {
      if (typeof tag !== "string") continue;

      // Match page: namespace (case insensitive)
      if (tag.toLowerCase().startsWith("page:")) {
        const pageStr = tag.substring(5).trim();
        const pageNum = parseInt(pageStr, 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          return pageNum; // Keep as 1-indexed (user's source of truth)
        }
      }
    }
  }

  return 0;
}

/**
 * Normalize a title by stripping page numbers.
 * Returns the base title suitable for grouping.
 */
function normalizeTitle(title: string): { baseTitle: string; position: number } {
  let normalized = title.trim();

  // Extract position number before stripping (1-indexed, matching user expectations)
  let position = 0;
  for (const { pattern, group } of PAGE_NUMBER_EXTRACTORS) {
    const match = normalized.match(pattern);
    if (match && match[group]) {
      position = parseInt(match[group], 10);
      break;
    }
  }

  // Strip page number patterns
  for (const pattern of PAGE_NUMBER_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }

  // Final trim and normalize whitespace
  normalized = normalized.trim().replace(/\s+/g, " ");

  return { baseTitle: normalized, position };
}

/**
 * Derive the stable sourceId for a title group from its normalized title.
 *
 * Historically this hashed the title with a 32-bit djb2 hash, but at ~65k
 * distinct title groups that has a ~50% chance of at least one collision
 * (birthday bound), which would silently merge two unrelated series into one
 * group. Using the lowercased normalized title directly is collision-free for
 * normal title sizes.
 *
 * PostgreSQL btree indexes cannot store arbitrarily large TEXT keys, so titles
 * above 240 UTF-8 bytes are represented as `title-sha256:<hex digest>`. That
 * keeps the `(sourceType, sourceId)` unique index safely bounded while retaining
 * a deterministic, collision-resistant key. Lowercasing matches the previous
 * hash input (`baseTitle.toLowerCase()`), so two titles differing only in case
 * still map to the same group, exactly as before.
 *
 * The migration 20260610000000_widen_title_group_sourceid backfills existing
 * rows from this same scheme.
 */
export function deriveTitleSourceId(normalizedTitle: string): string {
  const lowercasedTitle = normalizedTitle.toLowerCase();

  if (Buffer.byteLength(lowercasedTitle, "utf8") <= MAX_TITLE_SOURCE_ID_BYTES) {
    return lowercasedTitle;
  }

  return `${HASHED_TITLE_SOURCE_ID_PREFIX}${createHash("sha256")
    .update(lowercasedTitle)
    .digest("hex")}`;
}

/**
 * Parse a title tag to extract title group information.
 * Returns null if the title is too short or doesn't look groupable.
 */
function parseTitleGroup(title: string): TitleGroup | null {
  const { baseTitle, position } = normalizeTitle(title);

  // Skip if base title is too short
  if (baseTitle.length < 3) {
    return null;
  }

  // Skip if base title is just numbers
  if (/^\d+$/.test(baseTitle)) {
    return null;
  }

  return {
    sourceType: SourceType.TITLE,
    sourceId: deriveTitleSourceId(baseTitle),
    normalizedTitle: baseTitle,
    position,
  };
}

/**
 * Extract title groups from Hydrus file metadata.
 * Returns all valid title groups found in title: tags.
 * Uses page: tag for position if available, otherwise parses from title.
 */
export function extractTitleGroups(metadata: HydrusFileMetadata): TitleGroup[] {
  const titles = extractTitleTags(metadata);
  const groups: TitleGroup[] = [];
  const seen = new Set<string>();

  // Get page number from page: tag (preferred, 1-indexed as source of truth)
  const pageTagPosition = extractPageNumber(metadata);

  for (const title of titles) {
    const group = parseTitleGroup(title);
    if (group && !seen.has(group.sourceId)) {
      seen.add(group.sourceId);
      // Use page: tag position if available, otherwise use parsed position from title
      groups.push({
        ...group,
        position: pageTagPosition > 0 ? pageTagPosition : group.position,
      });
    }
  }

  return groups;
}
