"use client";

import Link from "next/link";
import { TagCategory } from "@/generated/prisma/enums";

interface Tag {
  id: number;
  name: string;
  category: TagCategory;
  postCount: number;
}

interface TagSidebarProps {
  tags: Tag[];
  currentTags?: string[];
}

const CATEGORY_ORDER: TagCategory[] = [
  TagCategory.ARTIST,
  TagCategory.COPYRIGHT,
  TagCategory.CHARACTER,
  TagCategory.GENERAL,
  TagCategory.META,
];

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
  [TagCategory.COPYRIGHT]: "text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300",
  [TagCategory.CHARACTER]: "text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
  [TagCategory.GENERAL]: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
  [TagCategory.META]: "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300",
};

const CATEGORY_LABELS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "Artists",
  [TagCategory.COPYRIGHT]: "Copyrights",
  [TagCategory.CHARACTER]: "Characters",
  [TagCategory.GENERAL]: "Tags",
  [TagCategory.META]: "Meta",
};

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return count.toString();
}

export function TagSidebar({ tags, currentTags = [] }: TagSidebarProps) {
  // Group tags by category
  const grouped = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<TagCategory, Tag[]>
  );

  // Sort tags within each category alphabetically
  for (const category of Object.keys(grouped) as TagCategory[]) {
    grouped[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  const buildSearchUrl = (tagName: string) => {
    const params = new URLSearchParams();
    params.set("tags", tagName);
    return `/search?${params.toString()}`;
  };

  return (
    <aside className="w-full lg:w-64 lg:shrink-0 space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const categoryTags = grouped[category];
        if (!categoryTags || categoryTags.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="space-y-1">
              {categoryTags.map((tag) => {
                const isActive = currentTags.includes(tag.name);
                return (
                  <li key={tag.id} className="flex items-baseline gap-1">
                    <Link
                      href={buildSearchUrl(tag.name)}
                      className={`truncate text-sm ${CATEGORY_COLORS[category]} ${
                        isActive ? "font-bold" : ""
                      }`}
                      title={tag.name}
                    >
                      {isActive && "• "}
                      {tag.name.replace(/_/g, " ")}
                    </Link>
                    <span
                      className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0"
                      title={`${tag.postCount.toLocaleString()} posts`}
                      aria-label={`${tag.postCount.toLocaleString()} posts`}
                    >
                      {formatCount(tag.postCount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {tags.length === 0 && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No tags</p>
      )}
    </aside>
  );
}
