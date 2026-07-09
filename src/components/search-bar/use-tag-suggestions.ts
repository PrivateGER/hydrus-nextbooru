"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TagSuggestion } from "@/components/search-bar/suggestions-dropdown";

interface UseTagSuggestionsOptions {
  selectedTags: string[];
  searchQuery: string;
  isExcludeMode: boolean;
  enabled: boolean; // false when in notes mode
  propsKey?: string; // changes when props change (navigation)
}

interface UseTagSuggestionsResult {
  suggestions: TagSuggestion[];
  displaySuggestions: TagSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  isLoading: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
  fetchPopularTags: (options?: { forceRefresh?: boolean; showDropdown?: boolean }) => Promise<void>;
}

export function useTagSuggestions({
  selectedTags,
  searchQuery,
  isExcludeMode,
  enabled,
  propsKey,
}: UseTagSuggestionsOptions): UseTagSuggestionsResult {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const prevSelectedTagsRef = useRef<string[]>([]);
  // Tracks the in-flight popular-tags request so a newer call can abort it.
  const popularAbortRef = useRef<AbortController | null>(null);
  // Always reflects the latest suggestions length without forcing fetchPopularTags
  // to re-create (which would re-run the focus/selection effects). Updated in an
  // effect (refs must not be written during render); focus events dispatch after
  // passive effects flush, so fetchPopularTags always sees the current length.
  const suggestionsLengthRef = useRef(0);
  useEffect(() => {
    suggestionsLengthRef.current = suggestions.length;
  }, [suggestions]);

  // Close suggestions when props change (navigation) — adjusted during render
  // rather than in an effect.
  const [prevPropsKey, setPrevPropsKey] = useState(propsKey);
  if (prevPropsKey !== propsKey) {
    setPrevPropsKey(propsKey);
    setShowSuggestions(false);
  }

  // Fetch popular/narrowing tags on focus. Promise-chain with the loading flag
  // set inside it (one microtask later) so the selected-tags effect below can
  // call this without setting state synchronously from the effect body.
  const fetchPopularTags = useCallback((options: { forceRefresh?: boolean; showDropdown?: boolean } = {}) => {
    const { forceRefresh = false, showDropdown = true } = options;
    if (!enabled) return Promise.resolve();
    if (!forceRefresh && (searchQuery.length > 0 || suggestionsLengthRef.current > 0)) {
      return Promise.resolve();
    }

    // Abort any popular-tags request still in flight so a slow earlier response
    // cannot resolve after a newer one and clobber the suggestions.
    popularAbortRef.current?.abort();
    const controller = new AbortController();
    popularAbortRef.current = controller;

    return Promise.resolve()
      .then(() => {
        setIsLoading(true);

        const params = new URLSearchParams();
        params.set("q", "");
        params.set("limit", "25");
        if (selectedTags.length > 0) {
          params.set("selected", selectedTags.join(","));
        }
        return fetch(`/api/tags/search?${params.toString()}`, {
          signal: controller.signal,
        });
      })
      .then((response) => response.json())
      .then((data) => {
        // Filter out omnipresent tags when there are selected tags
        const filtered = selectedTags.length > 0
          ? data.tags.filter((t: TagSuggestion) => t.remainingCount === null || t.remainingCount > 0)
          : data.tags;

        setSuggestions(filtered);
        if (showDropdown) {
          setShowSuggestions(true);
        }
      })
      .catch((error) => {
        // Ignore AbortError - request was intentionally cancelled
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error fetching tags:", error);
      })
      .finally(() => {
        // Only the most recent request should clear the loading state; a stale
        // aborted request resolving later must not flip it off prematurely.
        if (popularAbortRef.current === controller) {
          setIsLoading(false);
        }
      });
  }, [searchQuery, selectedTags, enabled]);

  // Refresh narrowing tags when selectedTags changes
  // Keep dropdown open if it was already open (user interaction), otherwise don't open it (navigation)
  useEffect(() => {
    if (
      enabled &&
      searchQuery === "" &&
      selectedTags.length > 0 &&
      JSON.stringify(selectedTags) !== JSON.stringify(prevSelectedTagsRef.current)
    ) {
      const wasOpen = showSuggestions;
      fetchPopularTags({ forceRefresh: true, showDropdown: wasOpen });
    }
    prevSelectedTagsRef.current = selectedTags;
  }, [selectedTags, enabled, searchQuery, fetchPopularTags, showSuggestions]);

  // Reset suggestion state when the search inputs change — adjusted during
  // render rather than in an effect. Mirrors the pre-fetch clears the
  // debounced-search effect used to do synchronously.
  const [prevInputs, setPrevInputs] = useState({ enabled, searchQuery, selectedTags, isExcludeMode });
  if (
    prevInputs.enabled !== enabled ||
    prevInputs.searchQuery !== searchQuery ||
    prevInputs.selectedTags !== selectedTags ||
    prevInputs.isExcludeMode !== isExcludeMode
  ) {
    const excludeModeChanged = prevInputs.isExcludeMode !== isExcludeMode;
    setPrevInputs({ enabled, searchQuery, selectedTags, isExcludeMode });
    // Reset highlight when mode changes
    if (excludeModeChanged) setHighlightedIndex(-1);
    if (!enabled) {
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      const shouldFetch = searchQuery.length > 0 || (isExcludeMode && selectedTags.length > 0);
      if (!shouldFetch && selectedTags.length > 0) {
        setSuggestions([]);
      }
    }
  }

  // Debounced tag search
  useEffect(() => {
    const shouldFetch = enabled &&
      (searchQuery.length > 0 || (isExcludeMode && selectedTags.length > 0));
    if (!shouldFetch) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", searchQuery);
        params.set("limit", "10");
        if (selectedTags.length > 0) {
          params.set("selected", selectedTags.join(","));
        }
        const response = await fetch(`/api/tags/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setSuggestions(data.tags);
        setShowSuggestions(true);
        setHighlightedIndex(-1);
      } catch (error) {
        // Ignore AbortError - request was intentionally cancelled
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error fetching suggestions:", error);
      } finally {
        // Only clear loading if this request is still the current one; an
        // aborted (superseded) request must not flip the spinner off while a
        // newer fetch is in flight.
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedTags, isExcludeMode, enabled]);

  // Abort any in-flight popular-tags request on unmount.
  useEffect(() => {
    return () => {
      popularAbortRef.current?.abort();
    };
  }, []);

  // Sort and filter suggestions based on mode
  const displaySuggestions = isExcludeMode
    ? suggestions
        .filter((s) => s.remainingCount === null || s.remainingCount > 0)
        .filter((s) => !s.isMeta || (s.count ?? 0) > 0)
        .sort((a, b) => {
          if (a.isMeta && !b.isMeta) return 1;
          if (!a.isMeta && b.isMeta) return -1;
          return (b.count ?? 0) - (a.count ?? 0);
        })
    : suggestions.filter((s) => !s.isMeta || (s.count ?? 0) > 0);

  return {
    suggestions,
    displaySuggestions,
    showSuggestions,
    setShowSuggestions,
    isLoading,
    highlightedIndex,
    setHighlightedIndex,
    fetchPopularTags,
  };
}
