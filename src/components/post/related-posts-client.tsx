"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { ThumbnailCard } from "../thumbnail-card";
import type { RecommendedPost } from "@/lib/recommendations";

interface RelatedPostsClientProps {
  recommendations: RecommendedPost[];
}

/**
 * Client component that displays recommended posts with enhanced visuals.
 * Features: scroll indicators, larger thumbnails, header icon.
 */
export function RelatedPostsClient({ recommendations }: RelatedPostsClientProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state for gradient indicators
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

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

      {/* Filmstrip container with scroll indicators */}
      <div className="relative">
        {/* Left gradient fade */}
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-12 bg-gradient-to-r from-zinc-800 to-transparent transition-opacity duration-200 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Right gradient fade */}
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-12 bg-gradient-to-l from-zinc-800 to-transparent transition-opacity duration-200 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Scrollable filmstrip */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth"
        >
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
        </div>
      </div>
    </div>
  );
}
