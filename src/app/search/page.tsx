import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { PostGrid } from "@/components/post-grid";

import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { NoteSearchResult } from "@/components/note-search-result";
import { SearchBarSkeleton, PostGridSkeleton, PageHeaderSkeleton } from "@/components/skeletons";
import { searchPosts, searchNotes } from "@/lib/search";
import { ResolvedWildcard } from "@/lib/wildcard";
import { TagCategory } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Search - Booru",
  description: "Search posts by tags",
};

// Cache search results for 5 minutes, keyed by search parameters
const getCachedPostSearch = unstable_cache(
  async (tags: string[], page: number) => searchPosts(tags, page),
  ["post-search"],
  { revalidate: 300 }
);

const getCachedNoteSearch = unstable_cache(
  async (query: string, page: number) => searchNotes(query, page),
  ["note-search"],
  { revalidate: 300 }
);

function SearchPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading search results">
      <SearchBarSkeleton />
      <PageHeaderSkeleton />
      <PostGridSkeleton />
    </div>
  );
}

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700",
  [TagCategory.COPYRIGHT]: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700",
  [TagCategory.CHARACTER]: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  [TagCategory.GENERAL]: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  [TagCategory.META]: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700",
};

interface SearchPageProps {
  searchParams: Promise<{ tags?: string; notes?: string; page?: string }>;
}

async function SearchPageContent({ searchParams }: { searchParams: Promise<{ tags?: string; notes?: string; page?: string }> }) {
  const params = await searchParams;
  const tagsParam = params.tags || "";
  const tags = tagsParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const notesQuery = params.notes?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const isNotesSearch = notesQuery.length >= 2;

  // Execute search (cached for 5 minutes)
  const result = isNotesSearch
    ? await getCachedNoteSearch(notesQuery, page)
    : tags.length > 0
      ? await getCachedPostSearch(tags, page)
      : null;

  const posts = result && "posts" in result ? result.posts : [];
  const rawNotes = result && "notes" in result ? result.notes : [];

  // Group notes by contentHash to merge duplicate content (e.g., same Pixiv description across multiple images)
  const groupedNotes = rawNotes.reduce((acc, note) => {
    const existing = acc.get(note.contentHash);
    if (existing) {
      existing.posts.push(note.post);
    } else {
      acc.set(note.contentHash, { ...note, posts: [note.post] });
    }
    return acc;
  }, new Map<string, typeof rawNotes[0] & { posts: typeof rawNotes[0]["post"][] }>());
  const notes = Array.from(groupedNotes.values());

  const totalCount = result?.totalCount ?? 0;
  const totalPages = result?.totalPages ?? 0;
  const queryTimeMs = result?.queryTimeMs ?? 0;
  const resolvedWildcards: ResolvedWildcard[] = result && "resolvedWildcards" in result ? result.resolvedWildcards : [];
  const error = result?.error;

  const wildcardMap = new Map(resolvedWildcards.map((w) => [w.pattern, w]));
  const hasResults = isNotesSearch ? notes.length > 0 : posts.length > 0;
  const hasQuery = isNotesSearch || tags.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <SearchBar initialTags={tags} initialNotesQuery={notesQuery} initialMode={isNotesSearch ? "notes" : "tags"} />
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 border border-red-300 p-4 text-center dark:bg-red-900/50 dark:border-red-700">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isNotesSearch && resolvedWildcards.length > 0 && (
        <div className="rounded-lg bg-zinc-100 border border-zinc-300 p-3 text-sm dark:bg-zinc-800/50 dark:border-zinc-700">
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2 dark:text-zinc-400">Wildcard expansions</div>
          <div className="space-y-1">
            {resolvedWildcards.map((w) => (
              <details key={w.pattern} className="group">
                <summary className="cursor-pointer list-none flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors">
                  <span className="text-zinc-400 dark:text-zinc-500 group-open:rotate-90 transition-transform">▶</span>
                  <span className={w.negated ? "text-red-600 dark:text-red-400 line-through" : "text-purple-600 dark:text-purple-400"}>{w.pattern}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">→</span>
                  <span className="text-zinc-700 dark:text-zinc-300 truncate flex-1">{w.tagNames.join(", ")}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs whitespace-nowrap">
                    ({w.tagIds.length}{w.truncated ? "+" : ""} {w.tagIds.length === 1 ? "tag" : "tags"})
                  </span>
                </summary>
                <div className="pl-7 pr-2 pb-2 pt-1">
                  {w.tagNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {w.tagNames.map((name, idx) => (
                        <span key={name} className={`px-2 py-0.5 rounded border text-xs ${CATEGORY_COLORS[w.tagCategories[idx] as TagCategory] || "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"}`}>
                          {name.replace(/_/g, " ")}
                        </span>
                      ))}
                      {w.truncated && (
                        <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-500 text-xs italic border border-zinc-300 dark:bg-zinc-600 dark:text-zinc-400 dark:border-zinc-500">
                          +more (limit {w.tagIds.length})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 italic">No matching tags found</span>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNotesSearch ? (
            <>
              Notes containing: <span className="text-amber-400">&ldquo;{notesQuery}&rdquo;</span>
            </>
          ) : tags.length > 0 ? (
            <>
              Search:{" "}
              <span className="inline-flex flex-wrap items-center gap-1">
                {tags.map((tag, i) => {
                  const isNegated = tag.startsWith("-") && tag.length > 1;
                  const baseTag = isNegated ? tag.slice(1) : tag;
                  const isWildcard = baseTag.includes("*");
                  const info = wildcardMap.get(tag);
                  return (
                    <span key={tag}>
                      {i > 0 && <span className="text-zinc-500 mx-1">{isNegated ? "-" : "+"}</span>}
                      <span
                        className={isNegated ? "text-red-400 line-through" : isWildcard ? "text-purple-400" : "text-blue-400"}
                        title={info ? `Matches ${info.tagIds.length} tags: ${info.tagNames.slice(0, 5).join(", ")}${info.tagNames.length > 5 ? "..." : ""}` : undefined}
                      >
                        {baseTag}
                        {info && <span className="text-zinc-500 text-sm ml-1">({info.tagIds.length}{info.truncated ? "+" : ""})</span>}
                      </span>
                    </span>
                  );
                })}
              </span>
            </>
          ) : (
            "Search"
          )}
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalCount.toLocaleString()} {totalCount === 1 ? "result" : "results"}
          {hasQuery && (
            <span className="ml-2 text-zinc-400 dark:text-zinc-500">
              ({queryTimeMs < 1000 ? `${Math.round(queryTimeMs)}ms` : `${(queryTimeMs / 1000).toFixed(2)}s`})
            </span>
          )}
        </span>
      </div>

      {!hasQuery && (
        <div className="rounded-lg bg-white border border-zinc-200 p-8 text-center dark:bg-zinc-800 dark:border-transparent">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Enter tags or note content to search</p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">Use the &ldquo;Tags&rdquo; tab to search by tags, or &ldquo;Notes&rdquo; tab to search note content</p>
        </div>
      )}

      {hasQuery && !hasResults && !error && (
        <div className="rounded-lg bg-white border border-zinc-200 p-8 text-center dark:bg-zinc-800 dark:border-transparent">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            {isNotesSearch ? `No notes found containing "${notesQuery}"` : "No posts found matching all tags"}
          </p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            {isNotesSearch ? "Try different search terms or check your spelling" : "Try removing some tags or using different search terms"}
          </p>
        </div>
      )}

      {/* Top pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} />
      )}

      {isNotesSearch && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => <NoteSearchResult key={note.contentHash} note={note} />)}
        </div>
      )}

      {!isNotesSearch && posts.length > 0 && (
        <PostGrid posts={posts} />
      )}

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} />
      )}
    </div>
  );
}

/**
 * Render the search results page, handling tag-based and note-content searches with pagination.
 *
 * Processes search parameters (tags, notes, page), performs a cached search, groups duplicate notes,
 * and renders the search bar, wildcard expansions, result counts, results list (posts or notes),
 * pagination, and any error or empty-state messages.
 *
 * @param searchParams - A promise resolving to query parameters: `tags` (comma-separated string), `notes` (note query string), and `page` (page number string)
 * @returns The React element for the search page containing the search UI and results
 */
export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent searchParams={searchParams} />
    </Suspense>
  );
}