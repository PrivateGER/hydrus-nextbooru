import Link from "next/link";
import { TagCategory } from "@/generated/prisma/enums";
import { TAG_LINK_COLORS } from "@/lib/tag-colors";
import { buildRefinedSearchUrl } from "@/lib/search-refine";
import type { RelatedTag } from "@/lib/search";

interface RelatedTagsSidebarProps {
  relatedTags: RelatedTag[];
  /** The active query's tags, as they appear in the URL (negations included) */
  currentTags: string[];
}

const CATEGORY_ORDER: TagCategory[] = [
  TagCategory.ARTIST,
  TagCategory.COPYRIGHT,
  TagCategory.CHARACTER,
  TagCategory.GENERAL,
  TagCategory.META,
];

const CATEGORY_LABELS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "Artists",
  [TagCategory.COPYRIGHT]: "Copyrights",
  [TagCategory.CHARACTER]: "Characters",
  [TagCategory.GENERAL]: "Tags",
  [TagCategory.META]: "Meta",
};

function TagList({ tags, currentTags }: { tags: RelatedTag[]; currentTags: string[] }) {
  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const categoryTags = tags.filter((t) => t.category === category);
        if (categoryTags.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="space-y-1">
              {categoryTags.map((tag) => (
                <li key={tag.id} className="group flex items-baseline gap-1.5">
                  <Link
                    href={buildRefinedSearchUrl(currentTags, tag.name, { negate: true })}
                    className="shrink-0 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-opacity"
                    title={`Exclude ${tag.name.replace(/_/g, " ")}`}
                    aria-label={`Exclude ${tag.name.replace(/_/g, " ")}`}
                  >
                    &minus;
                  </Link>
                  <Link
                    href={buildRefinedSearchUrl(currentTags, tag.name)}
                    className={`truncate text-sm rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${TAG_LINK_COLORS[category]}`}
                    title={`Add ${tag.name} to search`}
                  >
                    {tag.name.replace(/_/g, " ")}
                  </Link>
                  <span
                    className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
                    title={`On ${tag.count} of the posts shown`}
                  >
                    {tag.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Drill-down sidebar listing tags that co-occur with the visible search
 * results. Clicking a tag narrows the query; the minus link excludes it.
 * Counts are within-page occurrences, not global post counts.
 */
export function RelatedTagsSidebar({ relatedTags, currentTags }: RelatedTagsSidebarProps) {
  if (relatedTags.length === 0) return null;

  return (
    <>
      {/* Mobile: collapsible block above the results */}
      <details className="lg:hidden rounded-lg bg-white border border-zinc-200 p-4 dark:bg-zinc-800 dark:border-transparent">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Tags
        </summary>
        <div className="mt-3">
          <TagList tags={relatedTags} currentTags={currentTags} />
        </div>
      </details>

      {/* Desktop: left sidebar */}
      <aside className="hidden lg:block w-64 shrink-0" aria-label="Tags in these results">
        <div className="sticky top-20">
          <TagList tags={relatedTags} currentTags={currentTags} />
        </div>
      </aside>
    </>
  );
}
