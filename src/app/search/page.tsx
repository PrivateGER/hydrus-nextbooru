import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { NoteSearchResult } from "@/components/note-search-result";
import { searchPosts, searchNotes } from "@/lib/search";
import { ResolvedWildcard } from "@/lib/wildcard";
import { TagCategory } from "@/generated/prisma/client";

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

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "bg-red-900/50 text-red-300 border-red-700",
  [TagCategory.COPYRIGHT]: "bg-purple-900/50 text-purple-300 border-purple-700",
  [TagCategory.CHARACTER]: "bg-green-900/50 text-green-300 border-green-700",
  [TagCategory.GENERAL]: "bg-blue-900/50 text-blue-300 border-blue-700",
  [TagCategory.META]: "bg-orange-900/50 text-orange-300 border-orange-700",
};

interface SearchPageProps {
  searchParams: Promise<{ tags?: string; notes?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
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
        <div className="rounded-lg bg-red-900/50 border border-red-700 p-4 text-center">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {!isNotesSearch && resolvedWildcards.length > 0 && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3 text-sm">
          <div className="text-zinc-400 text-xs uppercase tracking-wide mb-2">Wildcard expansions</div>
          <div className="space-y-1">
            {resolvedWildcards.map((w) => (
              <details key={w.pattern} className="group">
                <summary className="cursor-pointer list-none flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-700/50 transition-colors">
                  <span className="text-zinc-500 group-open:rotate-90 transition-transform">▶</span>
                  <span className={w.negated ? "text-red-400 line-through" : "text-purple-400"}>{w.pattern}</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-zinc-300 truncate flex-1">{w.tagNames.join(", ")}</span>
                  <span className="text-zinc-500 text-xs whitespace-nowrap">
                    ({w.tagIds.length}{w.truncated ? "+" : ""} {w.tagIds.length === 1 ? "tag" : "tags"})
                  </span>
                </summary>
                <div className="pl-7 pr-2 pb-2 pt-1">
                  {w.tagNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {w.tagNames.map((name, idx) => (
                        <span key={name} className={`px-2 py-0.5 rounded border text-xs ${CATEGORY_COLORS[w.tagCategories[idx] as TagCategory] || "bg-zinc-700 text-zinc-300"}`}>
                          {name.replace(/_/g, " ")}
                        </span>
                      ))}
                      {w.truncated && (
                        <span className="px-2 py-0.5 rounded bg-zinc-600 text-zinc-400 text-xs italic border border-zinc-500">
                          +more (limit {w.tagIds.length})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-500 italic">No matching tags found</span>
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
        <span className="text-sm text-zinc-400">
          {totalCount.toLocaleString()} {totalCount === 1 ? "result" : "results"}
          {hasQuery && (
            <span className="ml-2 text-zinc-500">
              ({queryTimeMs < 1000 ? `${Math.round(queryTimeMs)}ms` : `${(queryTimeMs / 1000).toFixed(2)}s`})
            </span>
          )}
        </span>
      </div>

      {!hasQuery && (
        <div className="rounded-lg bg-zinc-800 p-8 text-center">
          <p className="text-lg text-zinc-400">Enter tags or note content to search</p>
          <p className="mt-2 text-sm text-zinc-500">Use the &ldquo;Tags&rdquo; tab to search by tags, or &ldquo;Notes&rdquo; tab to search note content</p>
        </div>
      )}

      {hasQuery && !hasResults && !error && (
        <div className="rounded-lg bg-zinc-800 p-8 text-center">
          <p className="text-lg text-zinc-400">
            {isNotesSearch ? `No notes found containing "${notesQuery}"` : "No posts found matching all tags"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {isNotesSearch ? "Try different search terms or check your spelling" : "Try removing some tags or using different search terms"}
          </p>
        </div>
      )}

      {/* Top pagination */}
      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} />
        </Suspense>
      )}

      {isNotesSearch && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => <NoteSearchResult key={note.contentHash} note={note} />)}
        </div>
      )}

      {!isNotesSearch && posts.length > 0 && (
        <Suspense
          fallback={
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-zinc-800" style={{ aspectRatio: [1, 0.75, 1.33, 0.8, 1.2][i % 5] }} />
              ))}
            </div>
          }
        >
          <PostGrid posts={posts} />
        </Suspense>
      )}

      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} />
        </Suspense>
      )}
    </div>
  );
}
