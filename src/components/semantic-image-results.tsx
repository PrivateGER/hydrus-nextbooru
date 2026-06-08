"use client";

import { useState, useEffect, useRef } from "react";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";

interface SemanticImageResult {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  distance: number;
  score?: number;
}

interface SemanticImageResultsProps {
  imageHash: string;
  page: number;
}

interface ResultsState {
  posts: SemanticImageResult[];
  totalCount: number;
  totalPages: number;
}

/**
 * Client island that renders image-based semantic search results.
 *
 * Driven entirely by the URL: it fetches the ranked matches for a cached query
 * image (`imageHash`) at the given `page`. Pagination reuses the cached vector,
 * so paging never re-uploads or re-embeds. A 404 means the cached embedding is
 * gone (e.g. the embedding model changed) and the user must upload again.
 */
export function SemanticImageResults({ imageHash, page }: SemanticImageResultsProps) {
  const [state, setState] = useState<ResultsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function run() {
      setIsLoading(true);
      setError(null);
      setExpired(false);

      const params = new URLSearchParams({ hash: imageHash, page: String(page) });

      try {
        const response = await fetch(`/api/posts/semantic-search/image?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setExpired(true);
            setState(null);
            return;
          }
          throw new Error(data.error || "Search failed");
        }
        setState({ posts: data.posts, totalCount: data.totalCount, totalPages: data.totalPages });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed");
        setState(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    run();

    return () => controller.abort();
  }, [imageHash, page]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Semantic: <span className="text-purple-400">uploaded image</span>
        </h1>
        {state && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {state.totalCount.toLocaleString()} {state.totalCount === 1 ? "result" : "results"}
          </span>
        )}
      </div>

      {expired && (
        <div className="rounded-lg bg-white border border-zinc-200 p-8 text-center dark:bg-zinc-800 dark:border-transparent">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">This image search has expired</p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            Switch to Semantic mode and drop or paste the image again to search.
          </p>
        </div>
      )}

      {error && !expired && (
        <div className="rounded-lg bg-red-100 border border-red-300 p-4 text-center dark:bg-red-900/50 dark:border-red-700">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {isLoading && state === null && !expired && !error && <ResultsSkeleton />}

      {state && state.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={state.totalPages} />
      )}

      {state && state.posts.length === 0 && !isLoading && (
        <div className="rounded-lg bg-white border border-zinc-200 p-8 text-center dark:bg-zinc-800 dark:border-transparent">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">No visually similar images found</p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            Generate image embeddings in Admin, or try a different image.
          </p>
        </div>
      )}

      {state && state.posts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {state.posts.map((post) => (
            <div key={post.hash} className="relative">
              <PostCard
                hash={post.hash}
                width={post.width}
                height={post.height}
                blurhash={post.blurhash}
                mimeType={post.mimeType}
                layout="grid"
              />
              {post.score != null && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white tabular-nums">
                  {Math.round(post.score * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {state && state.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={state.totalPages} />
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-zinc-300 dark:bg-zinc-700" />
        ))}
      </div>
    </div>
  );
}
