"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { PhotoIcon, HeartIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { BlurhashImage } from "./blurhash-image";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";

export type LayoutMode = "masonry" | "grid";

interface PostCardProps {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  layout?: LayoutMode;
  /** Heart overlay state; omit to hide the overlay entirely (e.g. filmstrips). */
  favorited?: boolean;
  /** Feed-only "not interested" control; fires only after the dismissal PUT succeeds. */
  onDismiss?: (hash: string) => void;
  /** Optional href override, e.g. to carry ?in= group navigation context. */
  href?: string;
}

// Timeout before showing error (starts when image enters viewport)
const LOAD_TIMEOUT_MS = 15000;

export function PostCard({ hash, width, height, blurhash, mimeType, layout = "masonry", favorited, onDismiss, href }: PostCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);
  const loadedRef = useRef(false); // Track loaded state for timeout callback

  const { favorited: fav, pending: favPending, toggle: toggleFavorite } = useFavoriteToggle(hash, favorited ?? false);
  const [dismissPending, setDismissPending] = useState(false);

  const handleDismiss = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dismissPending) return;
    setDismissPending(true);
    try {
      const response = await fetch(`/api/posts/${hash}/dismissal`, { method: "PUT" });
      // Only remove the card once the server has recorded the dismissal; on
      // failure keep it (no rollback needed — the card was never removed).
      if (response.ok) onDismiss?.(hash);
    } catch {
      // Network error: keep the card.
    } finally {
      if (mountedRef.current) setDismissPending(false);
    }
  };

  const isVideo = mimeType.startsWith("video/");
  const isAnimated = mimeType === "image/gif" || mimeType === "image/apng";
  const canHavePreview = isVideo || isAnimated;

  // Preload animated preview for videos/GIFs when card is visible
  useEffect(() => {
    if (!canHavePreview || !loaded) return;

    const img = imgRef.current;
    if (!img) return;

    // Use IntersectionObserver to only preload when visible
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;

        // Card is visible - start preloading animated preview
        const previewImg = new Image();
        previewImg.src = `/api/thumbnails/${hash}.webp?animated=true`;
        previewImg.onload = () => {
          if (mountedRef.current) {
            setPreviewLoaded(true);
          }
        };

        // Disconnect after triggering preload
        observer.disconnect();
      },
      { rootMargin: "50px" }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [hash, canHavePreview, loaded]);

  // Track mounted state to prevent setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync loadedRef with loaded state for timeout callback
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  // Use IntersectionObserver to detect when image enters viewport
  // Only then start timeout for load errors
  useEffect(() => {
    const img = imgRef.current;
    if (!img) {
      return;
    }

    // Already loaded (see above)
    if (loadedRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry.isIntersecting) return;

        // Image is now visible - check if already cached
        if (img.complete && img.naturalWidth > 0) {
          if (mountedRef.current) setLoaded(true);
          loadedRef.current = true;
          observer.disconnect();
          return;
        }

        // Start timeout only when image enters viewport
        // This prevents false errors for lazy-loaded below-fold images
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            // Use ref to get current loaded state, avoiding stale closure
            if (mountedRef.current && !loadedRef.current) {
              setError(true);
            }
          }, LOAD_TIMEOUT_MS);
        }

        observer.disconnect();
      },
      { rootMargin: "50px" } // Start slightly before visible
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, [hash]);

  // Handle successful load
  const handleLoad = () => {
    if (!mountedRef.current) return;
    loadedRef.current = true; // Update ref immediately to prevent race with timeout
    setLoaded(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  // Handle load error
  const handleError = () => {
    if (!mountedRef.current) return;
    setError(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  const isMasonry = layout === "masonry";
  const showAnimatedPreview = canHavePreview && previewLoaded && isHovering;

  const setImageRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    if (node?.complete && node.naturalWidth > 0) {
      loadedRef.current = true;
      setLoaded(true);
    }
  }, []);

  return (
    <Link
      href={href ?? `/post/${hash}`}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
        isMasonry ? "mb-3 break-inside-avoid" : ""
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Placeholder / aspect container */}
      {isMasonry ? (
        // Masonry: natural aspect ratio
        !loaded && (
          <div className="relative">
            {blurhash && width && height ? (
              <BlurhashImage
                blurhash={blurhash}
                width={width}
                height={height}
                className="w-full h-auto"
              />
            ) : (
              <div
                className="aspect-square w-full bg-zinc-300 dark:bg-zinc-700"
                style={
                  width && height
                    ? { aspectRatio: `${width} / ${height}` }
                    : undefined
                }
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
            </div>
          </div>
        )
      ) : (
        // Grid: fixed square aspect ratio
        <div className="aspect-square w-full">
          {!loaded && (
            <>
              {blurhash && width && height ? (
                <BlurhashImage
                  blurhash={blurhash}
                  width={width}
                  height={height}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-700" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Thumbnail image */}
      {!error ? (
        <>
          <img
            key={hash}
            ref={setImageRef}
            src={`/api/thumbnails/${hash}.webp`}
            alt=""
            className={
              isMasonry
                ? `w-full h-auto transition-opacity duration-300 ${
                    loaded ? "opacity-100" : "absolute inset-0 opacity-0"
                  } ${showAnimatedPreview ? "opacity-0" : ""}`
                : `absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                    loaded ? "opacity-100" : "opacity-0"
                  } ${showAnimatedPreview ? "opacity-0" : ""}`
            }
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
          />
          {/* Animated preview on hover */}
          {canHavePreview && previewLoaded && (
            <img
              src={`/api/thumbnails/${hash}.webp?animated=true`}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
                showAnimatedPreview ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </>
      ) : (
        <div className={`flex items-center justify-center bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 ${
          isMasonry ? "aspect-square" : "absolute inset-0"
        }`}>
          <PhotoIcon className="h-8 w-8" aria-hidden="true" />
        </div>
      )}

      {/* Video/GIF indicator */}
      {(isVideo || isAnimated) && (
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {isVideo ? "VIDEO" : "GIF"}
        </div>
      )}

      {/* Favorite heart overlay */}
      {favorited !== undefined && (
        <button
          onClick={toggleFavorite}
          disabled={favPending}
          aria-pressed={fav}
          title={fav ? "Remove from favorites" : "Add to favorites"}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          className={`absolute right-2 top-2 rounded-full bg-black/60 p-1.5 transition-opacity hover:bg-black/80 focus-visible:opacity-100 ${
            fav ? "opacity-100 text-pink-400" : "text-white opacity-0 group-hover:opacity-100"
          }`}
        >
          {fav ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
        </button>
      )}

      {/* Feed "not interested" overlay */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          disabled={dismissPending}
          title="Not interested"
          aria-label="Not interested"
          className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </Link>
  );
}
