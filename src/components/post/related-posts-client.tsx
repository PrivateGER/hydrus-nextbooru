"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { CircleStackIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ThumbnailCard } from "../thumbnail-card";
import { Filmstrip } from "../filmstrip";
import type { RecommendedPost } from "@/lib/recommendations";
import type { EmbeddedRelatedPost } from "@/lib/embeddings/store";

interface RelatedPostsClientProps {
  recommendations: RecommendedPost[];
  semanticPosts?: EmbeddedRelatedPost[];
}

type RelatedPostsMode = "similar" | "semantic";
const RELATED_POSTS_MODE_STORAGE_KEY = "nextbooru.relatedPostsMode";
const RELATED_POSTS_MODE_CHANGED_EVENT = "nextbooru:relatedPostsModeChanged";
let inMemoryRelatedPostsMode: RelatedPostsMode | null = null;

function isRelatedPostsMode(value: string | null): value is RelatedPostsMode {
  return value === "similar" || value === "semantic";
}

function getActiveMode(
  preferredMode: RelatedPostsMode,
  hasSimilarPosts: boolean,
  hasSemanticPosts: boolean
): RelatedPostsMode {
  if (preferredMode === "similar" && hasSimilarPosts) return "similar";
  if (preferredMode === "semantic" && hasSemanticPosts) return "semantic";
  return hasSimilarPosts ? "similar" : "semantic";
}

function getStoredRelatedPostsMode(fallback: RelatedPostsMode): RelatedPostsMode {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedMode = window.localStorage.getItem(RELATED_POSTS_MODE_STORAGE_KEY);
    if (isRelatedPostsMode(storedMode)) {
      return storedMode;
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts.
  }

  return inMemoryRelatedPostsMode ?? fallback;
}

function setStoredRelatedPostsMode(mode: RelatedPostsMode) {
  inMemoryRelatedPostsMode = mode;

  try {
    window.localStorage.setItem(RELATED_POSTS_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage access errors in restricted browsing contexts.
  }

  window.dispatchEvent(new Event(RELATED_POSTS_MODE_CHANGED_EVENT));
}

function subscribeRelatedPostsMode(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onLocalChange = () => onStoreChange();
  const onStorageChange = (event: StorageEvent) => {
    if (event.key === RELATED_POSTS_MODE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(RELATED_POSTS_MODE_CHANGED_EVENT, onLocalChange);
  window.addEventListener("storage", onStorageChange);

  return () => {
    window.removeEventListener(RELATED_POSTS_MODE_CHANGED_EVENT, onLocalChange);
    window.removeEventListener("storage", onStorageChange);
  };
}

/**
 * Client component that displays recommended posts with enhanced visuals.
 * Features: scroll indicators, larger thumbnails, header icon.
 */
export function RelatedPostsClient({ recommendations, semanticPosts = [] }: RelatedPostsClientProps) {
  const hasSimilarPosts = recommendations.length > 0;
  const hasSemanticPosts = semanticPosts.length > 0;
  const fallbackMode = hasSimilarPosts ? "similar" : "semantic";
  const getModeSnapshot = useCallback(
    () => getStoredRelatedPostsMode(fallbackMode),
    [fallbackMode]
  );
  const mode = useSyncExternalStore(
    subscribeRelatedPostsMode,
    getModeSnapshot,
    () => fallbackMode
  );

  if (!hasSimilarPosts && !hasSemanticPosts) {
    return null;
  }

  const activeMode = getActiveMode(mode, hasSimilarPosts, hasSemanticPosts);
  const title = activeMode === "similar" ? "Similar Posts" : "Semantically Related";
  const Icon = activeMode === "similar" ? SparklesIcon : CircleStackIcon;
  const iconClassName = activeMode === "similar" ? "text-amber-400" : "text-purple-400";
  const items = activeMode === "similar"
    ? recommendations.map((post) => ({
        post,
        title: `Similarity score ${post.score.toFixed(3)}`,
      }))
    : semanticPosts.map((post) => ({
        post,
        title: `Cosine distance ${post.distance.toFixed(3)}`,
      }));
  const selectMode = (nextMode: RelatedPostsMode) => {
    setStoredRelatedPostsMode(nextMode);
  };

  return (
    <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-4">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconClassName}`} />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length} {items.length === 1 ? "image" : "images"}
          </span>
        </div>

        {hasSimilarPosts && hasSemanticPosts && (
          <div className="flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-900" role="tablist" aria-label="Related post mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "similar"}
              onClick={() => selectMode("similar")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                activeMode === "similar"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              title="Show tag-based similar posts"
            >
              <SparklesIcon className="h-4 w-4" />
              Similar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "semantic"}
              onClick={() => selectMode("semantic")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                activeMode === "semantic"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              title="Show embedding-based semantically related posts"
            >
              <CircleStackIcon className="h-4 w-4" />
              Semantic
            </button>
          </div>
        )}
      </div>

      {/* Filmstrip with scroll indicators */}
      <Filmstrip>
        {items.map(({ post, title: linkTitle }) => (
          <Link
            key={post.hash}
            href={`/post/${post.hash}`}
            className="shrink-0 rounded-lg bg-zinc-300 dark:bg-zinc-700 shadow-md snap-start transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={linkTitle}
          >
            <ThumbnailCard
              hash={post.hash}
              width={post.width}
              height={post.height}
              blurhash={post.blurhash}
              mimeType={post.mimeType}
              heightClass="h-36"
              className="rounded-lg"
            />
          </Link>
        ))}
      </Filmstrip>
    </div>
  );
}
