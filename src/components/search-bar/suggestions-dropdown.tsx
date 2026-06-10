"use client";

import { forwardRef, useId } from "react";
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

/**
 * Builds the DOM id for the option at `index` within a given listbox. Shared
 * with the combobox input so its `aria-activedescendant` can reference the
 * active option without the two components needing to coordinate ids directly.
 */
export function getOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

interface SuggestionsDropdownProps {
  suggestions: TagSuggestion[];
  highlightedIndex: number;
  isExcludeMode: boolean;
  onSelect: (tagName: string) => void;
  /**
   * id of the listbox container, referenced by the combobox input's
   * aria-controls / aria-activedescendant. Optional: when omitted, a stable id
   * is generated so each option still carries a unique id.
   */
  listboxId?: string;
}

export const SuggestionsDropdown = forwardRef<HTMLDivElement, SuggestionsDropdownProps>(
  function SuggestionsDropdown({ suggestions, highlightedIndex, isExcludeMode, onSelect, listboxId: listboxIdProp }, ref) {
    const fallbackListboxId = useId();
    const listboxId = listboxIdProp ?? fallbackListboxId;

    if (suggestions.length === 0) return null;

    return (
      <div
        ref={ref}
        id={listboxId}
        role="listbox"
        aria-label={isExcludeMode ? "Tags to exclude" : "Tag suggestions"}
        className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border ${
          isExcludeMode ? "border-red-400 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"
        } bg-white dark:bg-zinc-800 shadow-lg`}
      >
        {suggestions.map((suggestion, index) => (
          // role="option" must live on a non-interactive element that is a
          // child of the listbox (an <option> or a generic element), never a
          // <button>. Keyboard navigation is driven by the combobox input via
          // aria-activedescendant; mouse selection is handled here.
          <div
            key={suggestion.id}
            id={getOptionId(listboxId, index)}
            role="option"
            aria-selected={index === highlightedIndex}
            // Use onMouseDown (not onClick) so selection fires before the input's
            // blur, mirroring the original button behaviour without stealing focus.
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(suggestion.name);
            }}
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
          </div>
        ))}
      </div>
    );
  }
);
