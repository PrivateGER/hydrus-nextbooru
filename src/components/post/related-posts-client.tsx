"use client";

import Link from "next/link";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { ThumbnailCard } from "../thumbnail-card";
import { Filmstrip } from "../filmstrip";
import type { RecommendedPost } from "@/lib/recommendations";

interface RelatedPostsClientProps {
  recommendations: RecommendedPost[];
}

/**
 * Client component that displays recommended posts with enhanced visuals.
 * Features: scroll indicators, larger thumbnails, header icon.
 */
export function RelatedPostsClient({ recommendations }: RelatedPostsClientProps) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-zinc-800 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold">Similar Posts</h2>
        <span className="text-sm text-zinc-500">
          {recommendations.length} {recommendations.length === 1 ? "image" : "images"}
        </span>
      </div>

      {/* Filmstrip with scroll indicators */}
      <Filmstrip>
        {recommendations.map((rec) => (
          <Link
            key={rec.hash}
            href={`/post/${rec.hash}`}
            className="shrink-0 rounded-lg bg-zinc-700 shadow-md snap-start transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 hover:shadow-lg"
          >
            <ThumbnailCard
              hash={rec.hash}
              width={rec.width}
              height={rec.height}
              blurhash={rec.blurhash}
              mimeType={rec.mimeType}
              heightClass="h-36"
              className="rounded-lg"
            />
          </Link>
        ))}
      </Filmstrip>
    </div>
  );
}
