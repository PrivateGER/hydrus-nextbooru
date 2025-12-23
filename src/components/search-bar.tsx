"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TagCategory } from "@/generated/prisma/enums";
import { isMetaTag } from "@/lib/meta-tags-shared";

type SearchMode = "tags" | "notes";

interface TagSuggestion {
  id: number;
  name: string;
  category: TagCategory | "META";
  count: number | null;
  remainingCount: number | null;
  isMeta?: boolean;
  description?: string;
}

const CATEGORY_COLORS: Record<TagCategory | "VIRTUAL_META", string> = {
  [TagCategory.ARTIST]: "text-red-400",
  [TagCategory.COPYRIGHT]: "text-purple-400",
  [TagCategory.CHARACTER]: "text-green-400",
  [TagCategory.GENERAL]: "text-blue-400",
  [TagCategory.META]: "text-orange-400",
  VIRTUAL_META: "text-cyan-400", // Virtual meta tags (video, portrait, etc.)
};

/**
 * Determine whether a tag string represents a negated tag.
 *
 * @returns `true` if the tag starts with `-` and has more than one character, `false` otherwise.
 */
function isNegatedTag(tag: string): boolean {
  return tag.startsWith("-") && tag.length > 1;
}

/**
 * Determine whether a tag contains a wildcard pattern.
 *
 * @returns `true` if the tag (after stripping negation prefix) contains `*`
 */
function isWildcardTag(tag: string): boolean {
  const baseTag = isNegatedTag(tag) ? tag.slice(1) : tag;
  return baseTag.includes("*");
}

/**
 * Return the tag name without a leading '-' negation prefix.
 *
 * @param tag - The tag string, possibly prefixed with `-` to indicate negation
 * @returns The tag name with the leading `-` removed if present
 */
function getBaseTagName(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : tag;
}

/**
 * Flip a tag's negation state.
 *
 * @param tag - The tag string, which may start with `-` to indicate negation.
 * @returns The tag with negation toggled: if `tag` starts with `-` (and has more than one character) the leading `-` is removed; otherwise a leading `-` is added.
 */
function toggleTagNegation(tag: string): string {
  return isNegatedTag(tag) ? tag.slice(1) : `-${tag}`;
}

/**
 * Check if a string is a valid SHA256 hash (64 hexadecimal characters).
 */
function isValidSha256Hash(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value.trim());
}

interface SearchBarProps {
  initialTags?: string[];
  initialNotesQuery?: string;
  initialMode?: SearchMode;
  placeholder?: string;
}

/**
 * Interactive search bar with two modes: tag search (with autocompletion) and note content search (full-text).
 *
 * @param initialTags - Optional initial list of selected tags. Each tag may be prefixed with `-` to indicate negation.
 * @param initialNotesQuery - Optional initial notes search query.
 * @param initialMode - Optional initial search mode ("tags" or "notes"). Defaults to "tags".
 * @param placeholder - Placeholder text shown in the input when no tags are selected (tag mode only).
 * @returns The rendered search bar UI that manages input, suggestions, selected tags, and triggers navigation to `/search`.
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
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Detect exclude mode when input starts with "-"
  const isExcludeMode = inputValue.startsWith("-");
  const searchQuery = isExcludeMode ? inputValue.slice(1) : inputValue;

  // Fetch popular/narrowing tags on focus (only in tags mode)
  const fetchPopularTags = useCallback(async () => {
    if (searchMode === "notes") return;
    if (searchQuery.length > 0 || suggestions.length > 0) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", "");
      params.set("limit", "25");
      if (selectedTags.length > 0) {
        params.set("selected", selectedTags.join(","));
      }
      const response = await fetch(`/api/tags/search?${params.toString()}`);
      const data = await response.json();

      // Filter out omnipresent tags when there are selected tags (they don't help narrow down)
      const filtered = selectedTags.length > 0
        ? data.tags.filter((t: TagSuggestion) => t.remainingCount === null || t.remainingCount > 0)
        : data.tags;

      setSuggestions(filtered);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, suggestions.length, searchMode]);

  // Debounced tag search (only in tags mode)
  useEffect(() => {
    // Skip tag suggestions in notes mode
    if (searchMode === "notes") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Allow search with empty query when:
    // - In exclude mode with selected tags, OR
    // - No selected tags (to show popular tags - handled by API)
    const shouldFetch = searchQuery.length > 0 ||
      (isExcludeMode && selectedTags.length > 0);

    if (!shouldFetch) {
      // Don't clear suggestions if showing popular tags
      if (selectedTags.length > 0) {
        setSuggestions([]);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", searchQuery);
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
  }, [searchQuery, selectedTags, isExcludeMode, searchMode]);

  // Reset highlight when mode changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [isExcludeMode]);

  // Sort and filter suggestions based on mode
  // In exclude mode: show count (posts to remove), filter out omnipresent tags, sort by most impactful
  // Filter out meta tags with 0 count (no matches with current filters)
  const displaySuggestions = isExcludeMode
    ? suggestions
        .filter((s) => s.remainingCount === null || s.remainingCount > 0) // Hide omnipresent tags (would leave 0 posts)
        .filter((s) => !s.isMeta || (s.count ?? 0) > 0) // Hide meta tags with 0 count
        .sort((a, b) => {
          // Meta tags last, then sort by count
          if (a.isMeta && !b.isMeta) return 1;
          if (!a.isMeta && b.isMeta) return -1;
          return (b.count ?? 0) - (a.count ?? 0);
        })
    : suggestions.filter((s) => !s.isMeta || (s.count ?? 0) > 0);

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
    const newTags = selectedTags.map((t) => (t === tagName ? toggleTagNegation(t) : t));
    setSelectedTags(newTags);
    // Navigate to search with updated tags
    const params = new URLSearchParams();
    params.set("tags", newTags.join(","));
    router.push(`/search?${params.toString()}`);
  }, [selectedTags, router]);

  const removeTag = useCallback((tagName: string) => {
    const newTags = selectedTags.filter((t) => t !== tagName);
    setSelectedTags(newTags);
    // Navigate to search with updated tags (consistent with toggleNegation)
    if (newTags.length > 0) {
      const params = new URLSearchParams();
      params.set("tags", newTags.join(","));
      router.push(`/search?${params.toString()}`);
    } else {
      router.push('/search');
    }
  }, [selectedTags, router]);

  // Handle paste event to detect SHA256 hashes and navigate directly to post
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text").trim();
    if (isValidSha256Hash(pastedText)) {
      e.preventDefault();
      router.push(`/post/${pastedText.toLowerCase()}`);
    }
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchMode === "notes") {
        // In notes mode, Enter triggers search directly
        performSearch();
      } else {
        // In tags mode, handle autocomplete selection
        if (highlightedIndex >= 0 && displaySuggestions[highlightedIndex]) {
          addTag(displaySuggestions[highlightedIndex].name, isExcludeMode);
        } else if (inputValue.trim()) {
          // Add the input as a tag (supports wildcards and custom tags)
          addTag(inputValue.trim(), isExcludeMode);
        } else if (selectedTags.length > 0) {
          performSearch();
        }
      }
    } else if (e.key === "," || e.key === "Tab") {
      // Comma or Tab adds current input as tag (if any) - only in tags mode
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
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const performSearch = () => {
    const params = new URLSearchParams();

    if (searchMode === "notes") {
      // Notes search mode
      const query = inputValue.trim();
      if (query.length >= 2) {
        params.set("notes", query);
        router.push(`/search?${params.toString()}`);
      }
    } else {
      // Tags search mode
      const allTags = inputValue.trim()
        ? [...selectedTags, inputValue.trim().toLowerCase()]
        : selectedTags;

      if (allTags.length > 0) {
        params.set("tags", allTags.join(","));
        router.push(`/search?${params.toString()}`);
      }
    }
  };

  // Handle mode switch
  const switchMode = (mode: SearchMode) => {
    if (mode === searchMode) return;
    setSearchMode(mode);
    setInputValue("");
    setSelectedTags([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-2">
        <div className="inline-flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => switchMode("tags")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              searchMode === "tags"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Search by tags"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Tags
          </button>
          <button
            type="button"
            onClick={() => switchMode("notes")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              searchMode === "notes"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Full-text search in notes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </button>
        </div>
      </div>

      {/* Input container */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
        {/* Selected tags (shown in both modes for context filtering) */}
        {selectedTags.map((tag) => {
          const negated = isNegatedTag(tag);
          const wildcard = isWildcardTag(tag);
          const displayName = getBaseTagName(tag);
          const isMeta = isMetaTag(displayName);

          // Determine tag chip styling
          let chipClass = "bg-zinc-700";
          if (negated) {
            chipClass = "bg-red-900/50 text-red-300 border border-red-700";
          } else if (isMeta) {
            chipClass = "bg-cyan-900/50 text-cyan-300 border border-cyan-700";
          } else if (wildcard) {
            chipClass = "bg-purple-900/50 text-purple-300 border border-purple-700";
          }

          return (
            <span
              key={tag}
              className={`flex items-center gap-1 rounded text-sm ${chipClass}`}
            >
              <button
                type="button"
                onClick={() => searchMode === "tags" && toggleNegation(tag)}
                className={`px-2 py-0.5 rounded-l ${searchMode === "tags" ? "hover:bg-white/10" : "cursor-default"}`}
                title={searchMode === "tags" ? (negated ? "Click to include" : "Click to exclude") : "Tag filter"}
              >
                {negated && <span className="text-red-400 font-bold">-</span>}
                {isMeta && !negated && <span className="text-cyan-500 text-xs mr-1">⚙</span>}
                <span className={negated ? "line-through opacity-80" : ""}>
                  {displayName}
                  {wildcard && <span className="text-purple-400 ml-0.5">✱</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="px-1.5 py-0.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-r"
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
          className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
        />

        {/* Search button */}
        <button
          type="button"
          onClick={performSearch}
          className="rounded bg-zinc-700 px-3 py-1 text-sm font-medium hover:bg-zinc-600"
        >
          Search
        </button>
      </div>

      {/* Notes mode hint */}
      {searchMode === "notes" && inputValue.length > 0 && inputValue.length < 2 && (
        <div className="mt-1 text-xs text-zinc-500">
          Enter at least 2 characters to search
        </div>
      )}

      {/* Suggestions dropdown (tags mode only) */}
      {searchMode === "tags" && showSuggestions && displaySuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border ${isExcludeMode ? "border-red-700" : "border-zinc-700"} bg-zinc-800 shadow-lg`}
        >
          {displaySuggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`group flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-700 ${
                index === highlightedIndex ? "bg-zinc-700" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => addTag(suggestion.name, isExcludeMode)}
                className="flex-1 text-left"
              >
                {suggestion.isMeta && (
                  <span className="text-cyan-600 text-xs mr-1.5 font-medium">system:</span>
                )}
                <span className={CATEGORY_COLORS[suggestion.isMeta ? "VIRTUAL_META" : suggestion.category]}>
                  {suggestion.name.replace(/_/g, " ")}
                </span>
                {suggestion.isMeta && suggestion.description && (
                  <span className="text-zinc-500 text-xs ml-2">
                    {suggestion.description}
                  </span>
                )}
              </button>
              <span className={`text-xs ${isExcludeMode ? "text-red-400" : "text-zinc-500"}`}>
                {isExcludeMode ? `-${suggestion.count ?? 0}` : (suggestion.count ?? 0)}
              </span>
            </div>
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