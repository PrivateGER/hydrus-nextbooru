"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TagCategory } from "@/generated/prisma/enums";

interface TagSuggestion {
  id: number;
  name: string;
  category: TagCategory;
  count: number;
}

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-400",
  [TagCategory.COPYRIGHT]: "text-purple-400",
  [TagCategory.CHARACTER]: "text-green-400",
  [TagCategory.GENERAL]: "text-blue-400",
  [TagCategory.META]: "text-orange-400",
};

/**
 * Check if a tag is negated (prefixed with `-`)
 */
function isNegatedTag(tag: string): boolean {
  return tag.startsWith("-") && tag.length > 1;
}

/**
 * Get the base tag name without the negation prefix
 */
function getBaseTagName(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : tag;
}

/**
 * Toggle the negation of a tag
 */
function toggleTagNegation(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : `-${tag}`;
}

interface SearchBarProps {
  initialTags?: string[];
  placeholder?: string;
}

export function SearchBar({ initialTags = [], placeholder = "Search tags..." }: SearchBarProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (inputValue.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", inputValue);
        params.set("limit", "10");
        if (selectedTags.length > 0) {
          params.set("selected", selectedTags.join(","));
        }
        const response = await fetch(`/api/tags/search?${params.toString()}`);
        const data = await response.json();
        setSuggestions(data.tags);
        setShowSuggestions(true);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue, selectedTags]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = useCallback((tagName: string, negated: boolean = false) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (!normalizedTag) return;

    // Handle if the tag itself has a negation prefix
    const isInputNegated = isNegatedTag(normalizedTag);
    const baseTag = getBaseTagName(normalizedTag);
    const shouldNegate = negated || isInputNegated;
    const finalTag = shouldNegate ? `-${baseTag}` : baseTag;

    // Check if the base tag already exists (with or without negation)
    const existingIndex = selectedTags.findIndex(
      (t) => getBaseTagName(t) === baseTag
    );

    if (existingIndex >= 0) {
      // Tag exists - if same negation state, do nothing; otherwise update it
      if (selectedTags[existingIndex] === finalTag) {
        // Already exists with same state, just clear input
      } else {
        // Replace with new negation state
        setSelectedTags((prev) => {
          const updated = [...prev];
          updated[existingIndex] = finalTag;
          return updated;
        });
      }
    } else {
      // Add new tag
      setSelectedTags((prev) => [...prev, finalTag]);
    }

    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [selectedTags]);

  const toggleNegation = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.map((t) => (t === tagName ? toggleTagNegation(t) : t))
    );
  }, []);

  const removeTag = useCallback((tagName: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagName));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addTag(suggestions[highlightedIndex].name);
      } else if (inputValue.trim()) {
        // Add as custom tag or perform search
        if (selectedTags.length > 0 || inputValue.trim()) {
          performSearch();
        }
      } else if (selectedTags.length > 0) {
        performSearch();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Backspace" && inputValue === "" && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const performSearch = () => {
    const allTags = inputValue.trim()
      ? [...selectedTags, inputValue.trim().toLowerCase()]
      : selectedTags;

    if (allTags.length > 0) {
      const params = new URLSearchParams();
      params.set("tags", allTags.join(","));
      router.push(`/search?${params.toString()}`);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Input container */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        {/* Selected tags */}
        {selectedTags.map((tag) => {
          const negated = isNegatedTag(tag);
          const displayName = getBaseTagName(tag);
          return (
            <span
              key={tag}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-sm ${
                negated
                  ? "bg-red-900/50 text-red-300 border border-red-700"
                  : "bg-zinc-700"
              }`}
            >
              {negated && (
                <span className="text-red-400 font-bold" title="Excluded">
                  -
                </span>
              )}
              <span className={negated ? "line-through opacity-80" : ""}>
                {displayName}
              </span>
              <button
                type="button"
                onClick={() => toggleNegation(tag)}
                className={`text-xs px-1 rounded ${
                  negated
                    ? "text-green-400 hover:text-green-300 hover:bg-green-900/30"
                    : "text-red-400 hover:text-red-300 hover:bg-red-900/30"
                }`}
                title={negated ? "Include this tag" : "Exclude this tag"}
              >
                {negated ? "+" : "-"}
              </button>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-zinc-400 hover:text-white"
              >
                &times;
              </button>
            </span>
          );
        })}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowSuggestions(true)}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
        />

        {/* Search button */}
        <button
          type="button"
          onClick={performSearch}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-500"
        >
          Search
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => addTag(suggestion.name)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-700 ${
                index === highlightedIndex ? "bg-zinc-700" : ""
              }`}
            >
              <span className={CATEGORY_COLORS[suggestion.category]}>
                {suggestion.name.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-zinc-500">{suggestion.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        </div>
      )}
    </div>
  );
}
