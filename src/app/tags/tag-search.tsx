"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface TagSearchProps {
  initialQuery: string;
}

export function TagSearch({ initialQuery }: TagSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== initialQuery) {
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
          params.set("q", query);
        } else {
          params.delete("q");
        }
        // Reset to page 1 when searching
        params.delete("page");

        const queryString = params.toString();
        router.push(`/tags${queryString ? `?${queryString}` : ""}`);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, initialQuery, router, searchParams]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tags..."
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        >
          &times;
        </button>
      )}
    </div>
  );
}
