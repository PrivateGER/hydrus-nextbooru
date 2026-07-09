"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TagTreeSelector } from "@/components/tag-tree-selector";
import { PostGrid } from "@/components/post-grid";
import { Pagination } from "@/components/pagination";
import { POSTS_PER_PAGE } from "@/lib/pagination";

interface Post {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

interface PostsResponse {
  posts: Post[];
  totalCount: number;
  totalPages: number;
}

interface FetchedResults extends PostsResponse {
  /** `tags|page` key the results were fetched for. */
  key: string;
}

/**
 * Render the tag-based filtering UI with a tag selector, results area, loading and empty states, and pagination.
 *
 * Reads selected tags and page from the URL, fetches matching posts when tags or page change, and updates the URL when the selected tags change (resetting the page to 1). When no tags are selected it shows an instructional empty state and does not fetch results.
 *
 * @returns The component's rendered JSX: a two-column layout containing a TagTreeSelector and a results area that shows result counts, loading placeholders, a posts grid, a no-results message, and pagination controls when applicable.
 */
function TagTreeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse state from URL
  const tagsFromUrl = (searchParams.get("tags") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const pageFromUrl = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [selectedTags, setSelectedTags] = useState<string[]>(tagsFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  // Last completed search; posts/counts/loading are derived from it so the
  // fetch effect never has to set state synchronously.
  const [fetched, setFetched] = useState<FetchedResults | null>(null);

  // Sync state with URL when it changes (e.g., pagination clicks) — adjusted
  // during render rather than in an effect. The functional update keeps the
  // array identity stable when the tags are unchanged so the fetch effect
  // doesn't re-run after our own router.push.
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
  if (prevSearchParams !== searchParams) {
    setPrevSearchParams(searchParams);
    setSelectedTags((prev) => (prev.join(",") === tagsFromUrl.join(",") ? prev : tagsFromUrl));
    setCurrentPage(pageFromUrl);
    if (tagsFromUrl.length === 0) setFetched(null);
  }

  const searchKey = `${selectedTags.join(",")}|${currentPage}`;
  const hasTags = selectedTags.length > 0;
  const posts = hasTags && fetched ? fetched.posts : [];
  const totalCount = hasTags && fetched ? fetched.totalCount : 0;
  const totalPages = hasTags && fetched ? fetched.totalPages : 0;
  const isLoadingPosts = hasTags && fetched?.key !== searchKey;

  // Update URL when tags change (not page - pagination handles that via links)
  const updateUrl = useCallback(
    (tags: string[]) => {
      const params = new URLSearchParams();
      if (tags.length > 0) {
        params.set("tags", tags.join(","));
      }
      const queryString = params.toString();
      router.push(`/tree${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [router]
  );

  // Fetch posts when tags or page change
  useEffect(() => {
    if (selectedTags.length === 0) return;

    const key = `${selectedTags.join(",")}|${currentPage}`;
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("tags", selectedTags.join(","));
    params.set("page", currentPage.toString());
    params.set("limit", POSTS_PER_PAGE.toString());

    fetch(`/api/posts/search?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search failed with status ${response.status}`);
        return response.json();
      })
      .then((data: PostsResponse) => {
        setFetched({ key, posts: data.posts, totalCount: data.totalCount, totalPages: data.totalPages });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching posts:", error);
        // Record the failed search as empty so the loading skeleton clears.
        setFetched({ key, posts: [], totalCount: 0, totalPages: 0 });
      });

    return () => controller.abort();
  }, [selectedTags, currentPage]);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
    setCurrentPage(1);
    if (tags.length === 0) setFetched(null);
    updateUrl(tags);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tag Tree</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Select tags progressively to narrow down results
        </p>
      </div>

      {/* Two-column layout on larger screens */}
      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Tag selector column */}
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
          <TagTreeSelector
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
          />
        </div>

        {/* Results column */}
        <div className="min-w-0">
          {/* Results header */}
          {selectedTags.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {totalCount.toLocaleString()} {totalCount === 1 ? "result" : "results"}
              </span>
            </div>
          )}

          {/* Empty state */}
          {selectedTags.length === 0 && (
            <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-8 text-center">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-zinc-400 dark:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <p className="text-lg text-zinc-500 dark:text-zinc-400">Select a tag to start</p>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-400">
                Choose tags from the left to filter posts
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoadingPosts && selectedTags.length > 0 && (
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-4 xl:columns-5">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-zinc-200 dark:bg-zinc-800"
                  style={{ aspectRatio: [1, 0.75, 1.33, 0.8, 1.2][i % 5] }}
                />
              ))}
            </div>
          )}

          {/* Posts grid */}
          {!isLoadingPosts && posts.length > 0 && (
            <PostGrid posts={posts} />
          )}

          {/* No results */}
          {!isLoadingPosts && selectedTags.length > 0 && posts.length === 0 && (
            <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-8 text-center">
              <p className="text-lg text-zinc-500 dark:text-zinc-400">No posts found</p>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-400">
                Try removing some tags
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination currentPage={currentPage} totalPages={totalPages} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagTreeLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-1 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export default function TagTreePage() {
  return (
    <Suspense fallback={<TagTreeLoading />}>
      <TagTreeContent />
    </Suspense>
  );
}