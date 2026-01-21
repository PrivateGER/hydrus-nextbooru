"use client";

import Link from "next/link";
import { TagCategory } from "@/generated/prisma/enums";
import { TAG_LINK_COLORS } from "@/lib/tag-colors";

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
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="space-y-1">
              {categoryTags.map((tag) => {
                const isActive = currentTags.includes(tag.name);
                return (
                  <li key={tag.id} className="flex items-baseline gap-1">
                    <Link
                      href={buildSearchUrl(tag.name)}
                      className={`truncate text-sm ${TAG_LINK_COLORS[category]} ${
                        isActive ? "font-bold" : ""
                      }`}
                      title={tag.name}
                    >
                      {isActive && "• "}
                      {tag.name.replace(/_/g, " ")}
                    </Link>
                    <span
                      className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
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
