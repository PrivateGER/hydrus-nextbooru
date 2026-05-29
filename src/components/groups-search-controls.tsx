"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlassIcon, UserIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { TagCategory } from "@/generated/prisma/enums";
import { isValidCreatorName } from "@/lib/creator-names";
import {
  SuggestionsDropdown,
  type TagSuggestion,
} from "@/components/search-bar/suggestions-dropdown";

interface GroupsSearchControlsProps {
  initialQuery: string;
  initialCreator: string;
}

export function GroupsSearchControls({
  initialQuery,
  initialCreator,
}: GroupsSearchControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [creator, setCreator] = useState(initialCreator);
  const [creatorSuggestions, setCreatorSuggestions] = useState<TagSuggestion[]>([]);
  const [showCreatorSuggestions, setShowCreatorSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const creatorInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        creatorInputRef.current &&
        !creatorInputRef.current.contains(event.target as Node)
      ) {
        setShowCreatorSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showCreatorSuggestions) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", creator.trim());
        params.set("category", TagCategory.ARTIST);
        params.set("validCreators", "true");
        params.set("withGroups", "true");
        params.set("limit", "10");

        const response = await fetch(`/api/tags/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        const tags = Array.isArray(data.tags) ? data.tags as TagSuggestion[] : [];
        setCreatorSuggestions(
          tags.filter((tag) => tag.category === TagCategory.ARTIST && isValidCreatorName(tag.name))
        );
        setHighlightedIndex(-1);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching creator suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [creator, showCreatorSuggestions]);

  const pushGroupsUrl = useCallback((next: { query: string; creator: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmedQuery = next.query.trim();
    const trimmedCreator = next.creator.trim();

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    } else {
      params.delete("q");
    }

    if (trimmedCreator) {
      params.set("creator", trimmedCreator);
    } else {
      params.delete("creator");
    }

    params.delete("page");

    const queryString = params.toString();
    router.push(`/groups${queryString ? `?${queryString}` : ""}`);
  }, [router, searchParams]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowCreatorSuggestions(false);
    pushGroupsUrl({ query, creator });
  };

  const applyCreator = useCallback((name: string) => {
    setCreator(name);
    setShowCreatorSuggestions(false);
    pushGroupsUrl({ query, creator: name });
  }, [pushGroupsUrl, query]);

  const clearFilters = () => {
    setQuery("");
    setCreator("");
    setShowCreatorSuggestions(false);
    pushGroupsUrl({ query: "", creator: "" });
  };

  const handleCreatorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && creatorSuggestions.length > 0) {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, creatorSuggestions.length - 1));
    } else if (event.key === "ArrowUp" && creatorSuggestions.length > 0) {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && highlightedIndex >= 0 && creatorSuggestions[highlightedIndex]) {
      event.preventDefault();
      applyCreator(creatorSuggestions[highlightedIndex].name);
    } else if (event.key === "Escape") {
      setShowCreatorSuggestions(false);
    }
  };

  const hasFilters = query.trim() !== "" || creator.trim() !== "";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-500 md:flex-row md:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="sr-only">Search groups</span>
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>

        <div className="relative flex min-w-0 flex-1 items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700 md:border-l md:border-t-0 md:pl-3 md:pt-0">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Filter by creator</span>
            <UserIcon className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <input
              ref={creatorInputRef}
              type="search"
              value={creator}
              onChange={(event) => {
                setCreator(event.target.value);
                setShowCreatorSuggestions(true);
              }}
              onFocus={() => setShowCreatorSuggestions(true)}
              onKeyDown={handleCreatorKeyDown}
              placeholder="Creator"
              role="combobox"
              aria-expanded={showCreatorSuggestions && creatorSuggestions.length > 0}
              aria-controls="groups-creator-suggestions"
              aria-autocomplete="list"
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </label>
          {/* Fixed-width slot keeps the input from shifting when the spinner mounts */}
          <div className="h-4 w-4 shrink-0" aria-hidden="true">
            {isLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-blue-500" />
            )}
          </div>
          {showCreatorSuggestions && creatorSuggestions.length > 0 && (
            <div id="groups-creator-suggestions">
              <SuggestionsDropdown
                ref={suggestionsRef}
                suggestions={creatorSuggestions}
                highlightedIndex={highlightedIndex}
                isExcludeMode={false}
                onSelect={applyCreator}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          )}
          <button
            type="submit"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
