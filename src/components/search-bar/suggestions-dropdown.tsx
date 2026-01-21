"use client";

import { forwardRef } from "react";
import { TagCategory } from "@/generated/prisma/enums";
import { TAG_TEXT_COLORS_WITH_META } from "@/lib/tag-colors";

export interface TagSuggestion {
  id: number;
  name: string;
  category: TagCategory;
  count: number | null;
  remainingCount: number | null;
  /** True for virtual/system tags (video, portrait, etc.) that aren't in the database */
  isMeta?: boolean;
  description?: string;
}

interface SuggestionsDropdownProps {
  suggestions: TagSuggestion[];
  highlightedIndex: number;
  isExcludeMode: boolean;
  onSelect: (tagName: string) => void;
}

export const SuggestionsDropdown = forwardRef<HTMLDivElement, SuggestionsDropdownProps>(
  function SuggestionsDropdown({ suggestions, highlightedIndex, isExcludeMode, onSelect }, ref) {
    if (suggestions.length === 0) return null;

    return (
      <div
        ref={ref}
        role="listbox"
        aria-label={isExcludeMode ? "Tags to exclude" : "Tag suggestions"}
        className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border ${
          isExcludeMode ? "border-red-400 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"
        } bg-white dark:bg-zinc-800 shadow-lg`}
      >
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={index === highlightedIndex}
            onClick={() => onSelect(suggestion.name)}
            className={`flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer ${
              index === highlightedIndex ? "bg-zinc-100 dark:bg-zinc-700" : ""
            }`}
          >
            <span className="flex-1">
              {suggestion.isMeta && (
                <span className="text-cyan-600 dark:text-cyan-400 text-xs mr-1.5 font-medium">system:</span>
              )}
              <span className={TAG_TEXT_COLORS_WITH_META[suggestion.isMeta ? "VIRTUAL_META" : suggestion.category]}>
                {suggestion.name.replace(/_/g, " ")}
              </span>
              {suggestion.isMeta && suggestion.description && (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-2">
                  {suggestion.description}
                </span>
              )}
            </span>
            <span className={`text-xs ${isExcludeMode ? "text-red-600 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>
              {isExcludeMode ? `-${suggestion.count ?? 0}` : (suggestion.count ?? 0)}
            </span>
          </button>
        ))}
      </div>
    );
  }
);
