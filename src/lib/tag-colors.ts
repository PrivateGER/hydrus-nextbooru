import { TagCategory } from "@/generated/prisma/enums";

/**
 * Centralized tag category color definitions.
 *
 * Color scheme per category:
 * - ARTIST: Red
 * - COPYRIGHT: Purple
 * - CHARACTER: Green
 * - GENERAL: Blue
 * - META: Orange
 * - VIRTUAL_META: Cyan (for computed meta tags like video, portrait)
 */

/** Base text colors (no hover state) - for inline display */
export const TAG_TEXT_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-600 dark:text-red-400",
  [TagCategory.COPYRIGHT]: "text-purple-600 dark:text-purple-400",
  [TagCategory.CHARACTER]: "text-green-600 dark:text-green-400",
  [TagCategory.GENERAL]: "text-blue-600 dark:text-blue-400",
  [TagCategory.META]: "text-orange-600 dark:text-orange-400",
};

/** Text colors with hover state - for clickable links */
export const TAG_LINK_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
  [TagCategory.COPYRIGHT]: "text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300",
  [TagCategory.CHARACTER]: "text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
  [TagCategory.GENERAL]: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
  [TagCategory.META]: "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300",
};

/** Background + text + border colors for badge/chip style (e.g., search result tags) */
export const TAG_BADGE_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700",
  [TagCategory.COPYRIGHT]: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700",
  [TagCategory.CHARACTER]: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  [TagCategory.GENERAL]: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  [TagCategory.META]: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700",
};

/** Virtual meta tag color (for computed tags like video, portrait, etc.) */
export const VIRTUAL_META_COLOR = "text-cyan-600 dark:text-cyan-400";

/** Extended text colors including virtual meta - for search bar suggestions */
export const TAG_TEXT_COLORS_WITH_META: Record<TagCategory | "VIRTUAL_META", string> = {
  ...TAG_TEXT_COLORS,
  VIRTUAL_META: VIRTUAL_META_COLOR,
};
