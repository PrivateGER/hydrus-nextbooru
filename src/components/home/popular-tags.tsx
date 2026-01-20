import Link from "next/link";
import { TagCategory } from "@/generated/prisma/client";
import type { PopularTagsByCategory } from "@/lib/stats";
import { TAG_LINK_COLORS } from "@/lib/tag-colors";

/** Component-specific background colors with borders for category cards */
const CATEGORY_BG_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800/50",
  [TagCategory.COPYRIGHT]: "bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800/50",
  [TagCategory.CHARACTER]: "bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800/50",
  [TagCategory.GENERAL]: "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50",
  [TagCategory.META]: "bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800/50",
};

const CATEGORY_LABELS: Record<string, string> = {
  ARTIST: "Artists",
  CHARACTER: "Characters",
  COPYRIGHT: "Series",
  GENERAL: "Tags",
};

interface PopularTagsProps {
  tags: PopularTagsByCategory;
}

export function PopularTags({ tags }: PopularTagsProps) {
  const categories = ["ARTIST", "CHARACTER", "COPYRIGHT", "GENERAL"] as const;

  const hasAnyTags = categories.some(
    (cat) => tags[cat] && tags[cat].length > 0
  );

  if (!hasAnyTags) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Popular Tags</h2>
        <Link
          href="/tags"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          View all tags
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const categoryTags = tags[category];
          if (!categoryTags || categoryTags.length === 0) return null;

          return (
            <div
              key={category}
              className={`rounded-lg border p-4 ${CATEGORY_BG_COLORS[category as TagCategory]}`}
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-1.5">
                {categoryTags.slice(0, 8).map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={`/search?tags=${encodeURIComponent(tag.name)}`}
                      className={`group flex items-center justify-between text-sm ${TAG_LINK_COLORS[category as TagCategory]}`}
                    >
                      <span className="truncate">
                        {tag.name.replace(/_/g, " ")}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-400">
                        {tag.postCount.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
