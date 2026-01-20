"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  isNegatedTag,
  getBaseTagName,
  toggleTagNegation,
  isValidSha256Hash,
} from "@/lib/tag-utils";
import { ModeToggle, type SearchMode } from "./mode-toggle";
import { SelectedTagChip } from "./selected-tag-chip";
import { SuggestionsDropdown } from "./suggestions-dropdown";
import { useTagSuggestions } from "./use-tag-suggestions";

interface SearchBarProps {
  initialTags?: string[];
  initialNotesQuery?: string;
  initialMode?: SearchMode;
  placeholder?: string;
}

/**
 * Interactive search bar with two modes: tag search (with autocompletion) and note content search (full-text).
 */
export function SearchBar({
  initialTags = [],
  initialNotesQuery = "",
  initialMode = "tags",
  placeholder = "Search tags...",
}: SearchBarProps) {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [inputValue, setInputValue] = useState(initialMode === "notes" ? initialNotesQuery : "");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Detect exclude mode when input starts with "-"
  const isExcludeMode = inputValue.startsWith("-");
  const searchQuery = isExcludeMode ? inputValue.slice(1) : inputValue;

  // Use custom hook for tag suggestions
  const {
    displaySuggestions,
    showSuggestions,
    setShowSuggestions,
    isLoading,
    highlightedIndex,
    setHighlightedIndex,
    fetchPopularTags,
  } = useTagSuggestions({
    selectedTags,
    searchQuery,
    isExcludeMode,
    enabled: searchMode === "tags",
  });

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
  }, [setShowSuggestions]);

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlighted = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
      highlighted?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const addTag = useCallback((tagName: string, negated: boolean = false) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (!normalizedTag) return;

    const isInputNegated = isNegatedTag(normalizedTag);
    const baseTag = getBaseTagName(normalizedTag);
    const shouldNegate = negated || isInputNegated;
    const finalTag = shouldNegate ? `-${baseTag}` : baseTag;

    const existingIndex = selectedTags.findIndex(
      (t) => getBaseTagName(t) === baseTag
    );

    if (existingIndex >= 0) {
      if (selectedTags[existingIndex] !== finalTag) {
        setSelectedTags((prev) => {
          const updated = [...prev];
          updated[existingIndex] = finalTag;
          return updated;
        });
      }
    } else {
      setSelectedTags((prev) => [...prev, finalTag]);
    }

    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [selectedTags, setShowSuggestions]);

  const handleToggleNegation = useCallback((tagName: string) => {
    const newTags = selectedTags.map((t) => (t === tagName ? toggleTagNegation(t) : t));
    setSelectedTags(newTags);
    const params = new URLSearchParams();
    params.set("tags", newTags.join(","));
    router.push(`/search?${params.toString()}`);
  }, [selectedTags, router]);

  const handleRemoveTag = useCallback((tagName: string) => {
    const newTags = selectedTags.filter((t) => t !== tagName);
    setSelectedTags(newTags);
    if (newTags.length > 0) {
      const params = new URLSearchParams();
      params.set("tags", newTags.join(","));
      router.push(`/search?${params.toString()}`);
    } else {
      router.push('/search');
    }
  }, [selectedTags, router]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text").trim();
    if (isValidSha256Hash(pastedText)) {
      e.preventDefault();
      router.push(`/post/${pastedText.toLowerCase()}`);
    }
  }, [router]);

  const performSearch = useCallback(() => {
    const params = new URLSearchParams();

    if (searchMode === "notes") {
      const query = inputValue.trim();
      if (query.length >= 2) {
        params.set("notes", query);
        router.push(`/search?${params.toString()}`);
      }
    } else {
      const allTags = inputValue.trim()
        ? [...selectedTags, inputValue.trim().toLowerCase()]
        : selectedTags;

      if (allTags.length > 0) {
        params.set("tags", allTags.join(","));
        router.push(`/search?${params.toString()}`);
      }
    }
  }, [searchMode, inputValue, selectedTags, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchMode === "notes") {
        performSearch();
      } else {
        if (highlightedIndex >= 0 && displaySuggestions[highlightedIndex]) {
          addTag(displaySuggestions[highlightedIndex].name, isExcludeMode);
        } else if (inputValue.trim()) {
          addTag(inputValue.trim(), isExcludeMode);
        } else if (selectedTags.length > 0) {
          performSearch();
        }
      }
    } else if (e.key === "," || e.key === "Tab") {
      if (searchMode === "tags" && inputValue.trim()) {
        e.preventDefault();
        addTag(inputValue.trim(), isExcludeMode);
      }
    } else if (e.key === "ArrowDown") {
      if (searchMode === "tags" && displaySuggestions.length > 0) {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, displaySuggestions.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      if (searchMode === "tags" && displaySuggestions.length > 0) {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, -1));
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Backspace" && inputValue === "" && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const handleModeChange = (mode: SearchMode) => {
    if (mode === searchMode) return;
    setSearchMode(mode);
    setInputValue("");
    setSelectedTags([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleSuggestionSelect = useCallback((tagName: string) => {
    addTag(tagName, isExcludeMode);
  }, [addTag, isExcludeMode]);

  return (
    <div className="relative w-full max-w-2xl">
      <ModeToggle mode={searchMode} onModeChange={handleModeChange} />

      {/* Input container */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-500">
        {/* Selected tags */}
        {selectedTags.map((tag) => (
          <SelectedTagChip
            key={tag}
            tag={tag}
            canToggle={searchMode === "tags"}
            onToggleNegation={handleToggleNegation}
            onRemove={handleRemoveTag}
          />
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            if (searchMode === "tags") {
              if (inputValue) {
                setShowSuggestions(true);
              } else {
                fetchPopularTags();
              }
            }
          }}
          placeholder={
            searchMode === "notes"
              ? "Search note content..."
              : selectedTags.length === 0
              ? placeholder
              : ""
          }
          className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        )}

        {/* Search button */}
        <button
          type="button"
          onClick={performSearch}
          className="rounded bg-zinc-200 px-3 py-1 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          Search
        </button>
      </div>

      {/* Notes mode hint */}
      {searchMode === "notes" && inputValue.length > 0 && inputValue.length < 2 && (
        <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Enter at least 2 characters to search
        </div>
      )}

      {/* Suggestions dropdown */}
      {searchMode === "tags" && showSuggestions && (
        <SuggestionsDropdown
          ref={suggestionsRef}
          suggestions={displaySuggestions}
          highlightedIndex={highlightedIndex}
          isExcludeMode={isExcludeMode}
          onSelect={handleSuggestionSelect}
        />
      )}
    </div>
  );
}

// Re-export for backwards compatibility
export type { SearchMode } from "./mode-toggle";
