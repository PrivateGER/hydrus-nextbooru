"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TagSuggestion } from "./suggestions-dropdown";

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
  const prevPropsKeyRef = useRef(propsKey);

  // Close suggestions when props change (navigation)
  useEffect(() => {
    if (prevPropsKeyRef.current !== propsKey) {
      setShowSuggestions(false);
      prevPropsKeyRef.current = propsKey;
    }
  }, [propsKey]);

  // Fetch popular/narrowing tags on focus
  const fetchPopularTags = useCallback(async (options: { forceRefresh?: boolean; showDropdown?: boolean } = {}) => {
    const { forceRefresh = false, showDropdown = true } = options;
    if (!enabled) return;
    if (!forceRefresh && (searchQuery.length > 0 || suggestions.length > 0)) return;

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

      // Filter out omnipresent tags when there are selected tags
      const filtered = selectedTags.length > 0
        ? data.tags.filter((t: TagSuggestion) => t.remainingCount === null || t.remainingCount > 0)
        : data.tags;

      setSuggestions(filtered);
      if (showDropdown) {
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, suggestions.length, enabled]);

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

  // Debounced tag search
  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const shouldFetch = searchQuery.length > 0 ||
      (isExcludeMode && selectedTags.length > 0);

    if (!shouldFetch) {
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
  }, [searchQuery, selectedTags, isExcludeMode, enabled]);

  // Reset highlight when mode changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [isExcludeMode]);

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
