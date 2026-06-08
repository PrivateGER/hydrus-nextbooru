"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { PhotoIcon } from "@heroicons/react/24/outline";
import {
  isNegatedTag,
  getBaseTagName,
  toggleTagNegation,
  isValidSha256Hash,
} from "@/lib/tag-utils";
import { ModeToggle, type SearchMode } from "@/components/search-bar/mode-toggle";
import { SelectedTagChip } from "@/components/search-bar/selected-tag-chip";
import { SuggestionsDropdown } from "@/components/search-bar/suggestions-dropdown";
import { useTagSuggestions } from "@/components/search-bar/use-tag-suggestions";
import { cancelPendingImageUpload, isCurrentImageUpload } from "@/components/search-bar/image-upload-state";

interface SearchBarProps {
  initialTags?: string[];
  initialNotesQuery?: string;
  initialSemanticQuery?: string;
  initialMode?: SearchMode;
  placeholder?: string;
}

function getSearchBarStateKey(initialTags: string[], initialNotesQuery: string, initialSemanticQuery: string, initialMode: SearchMode): string {
  return `${initialMode}:${initialNotesQuery}:${initialSemanticQuery}:${initialTags.join(",")}`;
}

/**
 * Interactive search bar with two modes: tag search (with autocompletion) and note content search (full-text).
 */
export function SearchBar({
  initialTags = [],
  initialNotesQuery = "",
  initialSemanticQuery = "",
  initialMode = "tags",
  placeholder = "Search tags...",
}: SearchBarProps) {
  const stateKey = getSearchBarStateKey(initialTags, initialNotesQuery, initialSemanticQuery, initialMode);

  return (
    <SearchBarContent
      key={stateKey}
      initialTags={initialTags}
      initialNotesQuery={initialNotesQuery}
      initialSemanticQuery={initialSemanticQuery}
      initialMode={initialMode}
      placeholder={placeholder}
      stateKey={stateKey}
    />
  );
}

interface SearchBarContentProps {
  initialTags: string[];
  initialNotesQuery: string;
  initialSemanticQuery: string;
  initialMode: SearchMode;
  placeholder: string;
  stateKey: string;
}

function SearchBarContent({
  initialTags = [],
  initialNotesQuery = "",
  initialSemanticQuery = "",
  initialMode = "tags",
  placeholder = "Search tags...",
  stateKey,
}: SearchBarContentProps) {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [inputValue, setInputValue] = useState(
    initialMode === "notes"
      ? initialNotesQuery
      : initialMode === "semantic"
        ? initialSemanticQuery
        : ""
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);

  // Image-based semantic search (only used in "semantic" mode)
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageUploadAbortRef = useRef<AbortController | null>(null);

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
    propsKey: stateKey,
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

    // Ignore a lone "-" (empty base tag after stripping negation)
    if (normalizedTag === "-" || baseTag === "") return;

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
    inputRef.current?.focus();
  }, [selectedTags]);

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

  // Embed an uploaded image, then navigate to its results on the search page.
  // The hash (not the bytes) rides in the URL, so results are reload-safe and
  // shareable, and pagination reuses the cached vector.
  const handleImageSearch = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }

    imageUploadAbortRef.current?.abort();
    const controller = new AbortController();
    imageUploadAbortRef.current = controller;

    setIsUploadingImage(true);
    setImageError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/posts/semantic-search/image", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Image search failed");
      }

      if (!isCurrentImageUpload(imageUploadAbortRef, controller)) return;
      router.push(`/search?mode=semantic-image&imgHash=${data.imageHash}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!isCurrentImageUpload(imageUploadAbortRef, controller)) return;
      setImageError(err instanceof Error ? err.message : "Image search failed");
    } finally {
      if (isCurrentImageUpload(imageUploadAbortRef, controller)) {
        imageUploadAbortRef.current = null;
        setIsUploadingImage(false);
      }
    }
  }, [router]);

  // Abort an in-flight image upload on unmount.
  useEffect(() => {
    return () => imageUploadAbortRef.current?.abort();
  }, []);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    if (searchMode !== "semantic") return;
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSearch(file);
  }, [searchMode, handleImageSearch]);

  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSearch(file);
    // Reset so selecting the same file again re-triggers a search.
    e.target.value = "";
  }, [handleImageSearch]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    // In semantic mode, a pasted image runs an image-based semantic search.
    if (searchMode === "semantic") {
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageSearch(file);
            return;
          }
        }
      }
    }

    const pastedText = e.clipboardData.getData("text").trim();
    if (isValidSha256Hash(pastedText)) {
      e.preventDefault();
      router.push(`/post/${pastedText.toLowerCase()}`);
    }
  }, [router, searchMode, handleImageSearch]);

  const performSearch = useCallback(() => {
    const params = new URLSearchParams();

    if (searchMode === "notes" || searchMode === "semantic") {
      const query = inputValue.trim();
      if (query.length >= 2) {
        params.set(searchMode === "notes" ? "notes" : "semantic", query);
        router.push(`/search?${params.toString()}`);
      }
    } else {
      const rawTags = inputValue.trim()
        ? [...selectedTags, inputValue.trim().toLowerCase()]
        : selectedTags;

      // Normalize: filter out empty/invalid tags and dedupe by base tag name
      const seenBaseTags = new Set<string>();
      const normalizedTags = rawTags.filter((tag) => {
        const trimmed = tag.trim();
        // Filter out empty tags or lone "-"
        if (!trimmed || trimmed === "-") return false;

        const baseTag = getBaseTagName(trimmed);
        if (seenBaseTags.has(baseTag)) return false;
        seenBaseTags.add(baseTag);
        return true;
      });

      if (normalizedTags.length > 0) {
        params.set("tags", normalizedTags.join(","));
        router.push(`/search?${params.toString()}`);
      }
    }
  }, [searchMode, inputValue, selectedTags, router]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchMode === "notes" || searchMode === "semantic") {
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
    setImageError(null);
    setIsDraggingImage(false);
    cancelPendingImageUpload(imageUploadAbortRef, setIsUploadingImage);
  };

  const handleSuggestionSelect = useCallback((tagName: string) => {
    addTag(tagName, isExcludeMode);
  }, [addTag, isExcludeMode]);

  return (
    <div className="relative w-full max-w-2xl">
      <ModeToggle mode={searchMode} onModeChange={handleModeChange} />

      {/* Input container. In semantic mode it doubles as an image drop zone. */}
      <div
        onDragOver={searchMode === "semantic" ? (e) => { e.preventDefault(); setIsDraggingImage(true); } : undefined}
        onDragLeave={searchMode === "semantic" ? () => setIsDraggingImage(false) : undefined}
        onDrop={searchMode === "semantic" ? handleImageDrop : undefined}
        className={`flex flex-wrap items-center gap-1 rounded-lg border bg-white px-3 py-2 focus-within:ring-1 dark:bg-zinc-800 ${
          isDraggingImage
            ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-500 dark:ring-blue-500"
            : "border-zinc-300 focus-within:border-zinc-400 focus-within:ring-zinc-400 dark:border-zinc-700 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-500"
        }`}
      >
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
              setShowSuggestions(true);
              if (!inputValue) {
                fetchPopularTags();
              }
            }
          }}
          placeholder={
            searchMode === "notes"
              ? "Search note content..."
              : searchMode === "semantic"
                ? "Describe images, or drop/paste an image..."
              : selectedTags.length === 0
              ? placeholder
              : ""
          }
          className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />

        {/* Loading indicator */}
        {(isLoading || isUploadingImage) && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        )}

        {/* Image search trigger (semantic mode only) */}
        {searchMode === "semantic" && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              aria-label="Search by image"
              title="Search by image"
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <PhotoIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}

        {/* Search button */}
        <button
          type="button"
          onClick={performSearch}
          className="rounded bg-zinc-200 px-3 py-1 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800"
        >
          Search
        </button>
      </div>

      {/* Text search mode hint */}
      {(searchMode === "notes" || searchMode === "semantic") && inputValue.length > 0 && inputValue.length < 2 && (
        <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Enter at least 2 characters to search
        </div>
      )}

      {/* Image search error */}
      {searchMode === "semantic" && imageError && (
        <div className="mt-1 text-xs text-red-500">{imageError}</div>
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
