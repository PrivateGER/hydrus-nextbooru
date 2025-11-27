"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TagCategory } from "@/generated/prisma/enums";

interface TagSuggestion {
  id: number;
  name: string;
  category: TagCategory;
  count: number;
}

interface TagTreeResponse {
  tags: TagSuggestion[];
  postCount: number;
  selectedTags: string[];
}

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-400",
  [TagCategory.COPYRIGHT]: "text-purple-400",
  [TagCategory.CHARACTER]: "text-green-400",
  [TagCategory.GENERAL]: "text-blue-400",
  [TagCategory.META]: "text-orange-400",
};

const CATEGORY_BG_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "bg-red-900/30 border-red-800",
  [TagCategory.COPYRIGHT]: "bg-purple-900/30 border-purple-800",
  [TagCategory.CHARACTER]: "bg-green-900/30 border-green-800",
  [TagCategory.GENERAL]: "bg-blue-900/30 border-blue-800",
  [TagCategory.META]: "bg-orange-900/30 border-orange-800",
};

const CATEGORY_ORDER: TagCategory[] = [
  TagCategory.ARTIST,
  TagCategory.COPYRIGHT,
  TagCategory.CHARACTER,
  TagCategory.GENERAL,
  TagCategory.META,
];

interface TagTreeSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagTreeSelector({ selectedTags, onTagsChange }: TagTreeSelectorProps) {
  const [tags, setTags] = useState<TagSuggestion[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TagCategory | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTags.length > 0) {
        params.set("selected", selectedTags.join(","));
      }
      if (categoryFilter) {
        params.set("category", categoryFilter);
      }
      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      }
      params.set("limit", "100");

      const response = await fetch(`/api/tags/tree?${params.toString()}`);
      const data: TagTreeResponse = await response.json();
      setTags(data.tags);
      setPostCount(data.postCount);
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTags, categoryFilter, debouncedQuery]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = (tagName: string) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (!selectedTags.includes(normalizedTag)) {
      onTagsChange([...selectedTags, normalizedTag]);
      setSearchQuery("");
      searchInputRef.current?.focus();
    }
  };

  const removeTag = (tagName: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tagName));
  };

  const clearAll = () => {
    onTagsChange([]);
    setSearchQuery("");
  };

  // Group tags by category
  const groupedTags = CATEGORY_ORDER.reduce(
    (acc, category) => {
      const categoryTags = tags.filter((t) => t.category === category);
      if (categoryTags.length > 0) {
        acc[category] = categoryTags;
      }
      return acc;
    },
    {} as Record<TagCategory, TagSuggestion[]>
  );

  // When searching, show flat list; otherwise show grouped
  const displayTags = debouncedQuery
    ? { RESULTS: tags } as Record<string, TagSuggestion[]>
    : groupedTags;

  return (
    <div className="space-y-4">
      {/* Selected tags breadcrumb */}
      {selectedTags.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Selected Tags ({selectedTags.length})
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag, index) => (
              <span
                key={tag}
                className="group flex items-center gap-1 rounded bg-blue-600/30 border border-blue-500/50 px-2 py-1 text-sm"
              >
                <span className="text-zinc-400 text-xs">{index + 1}.</span>
                <span>{tag.replace(/_/g, " ")}</span>
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-zinc-400 hover:text-white"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            {postCount.toLocaleString()} {postCount === 1 ? "post" : "posts"} match
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tags..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setCategoryFilter("")}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            categoryFilter === ""
              ? "bg-zinc-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-white"
          }`}
        >
          All
        </button>
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? "bg-zinc-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            } ${CATEGORY_COLORS[cat]}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        </div>
      )}

      {/* Tags display */}
      {!isLoading && (
        <div className="space-y-4">
          {Object.entries(displayTags).map(([category, categoryTags]) => (
            <div key={category} className="space-y-2">
              {!debouncedQuery && (
                <h3 className={`text-xs font-medium uppercase tracking-wide ${
                  CATEGORY_COLORS[category as TagCategory] || "text-zinc-400"
                }`}>
                  {category} ({categoryTags.length})
                </h3>
              )}
              {debouncedQuery && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Search results ({categoryTags.length})
                </h3>
              )}
              <div className="flex flex-wrap gap-1">
                {categoryTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag.name)}
                    className={`group flex items-center gap-1.5 rounded border px-2 py-1 text-sm transition-all hover:border-zinc-500 hover:bg-zinc-700 ${
                      CATEGORY_BG_COLORS[tag.category]
                    }`}
                  >
                    <span className={CATEGORY_COLORS[tag.category]}>
                      {tag.name.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-400">
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {tags.length === 0 && debouncedQuery && (
            <div className="rounded-lg bg-zinc-800 p-6 text-center">
              <p className="text-zinc-400">No tags found for &quot;{debouncedQuery}&quot;</p>
              <p className="mt-1 text-sm text-zinc-500">
                Try a different search term
              </p>
            </div>
          )}

          {tags.length === 0 && !debouncedQuery && selectedTags.length > 0 && (
            <div className="rounded-lg bg-zinc-800 p-6 text-center">
              <p className="text-zinc-400">No more tags to filter by</p>
              <p className="mt-1 text-sm text-zinc-500">
                All remaining posts share the same tags
              </p>
            </div>
          )}

          {tags.length === 0 && !debouncedQuery && selectedTags.length === 0 && (
            <div className="rounded-lg bg-zinc-800 p-6 text-center">
              <p className="text-zinc-400">No tags found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
