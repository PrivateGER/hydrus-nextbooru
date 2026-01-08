"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { BlurhashImage } from "./blurhash-image";

export type LayoutMode = "masonry" | "grid";

interface PostCardProps {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  layout?: LayoutMode;
}

// Timeout before showing error (starts when image enters viewport)
const LOAD_TIMEOUT_MS = 15000;

export function PostCard({ hash, width, height, blurhash, mimeType, layout = "masonry" }: PostCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);
  const loadedRef = useRef(false); // Track loaded state for timeout callback

  const isVideo = mimeType.startsWith("video/");
  const isAnimated = mimeType === "image/gif" || mimeType === "image/apng";
  const canHavePreview = isVideo || isAnimated;

  // Handle hash changes and check for cached images.
  // If we don't do this, we get stuck with a blurhash.
  const prevHashRef = useRef(hash);
  useEffect(() => {
    const img = imgRef.current;

    // If hash changed, reset state first
    if (prevHashRef.current !== hash) {
      prevHashRef.current = hash;
      setLoaded(false);
      setError(false);
      setPreviewLoaded(false);
      loadedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }

    // Then check if image is already cached (precached or caused by bfcache navigation)
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      loadedRef.current = true;
    }
  }, [hash]);

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

  return (
    <Link
      href={`/post/${hash}`}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-800 transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 ${
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
                className="aspect-square w-full bg-zinc-700"
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
                <div className="absolute inset-0 bg-zinc-700" />
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
            ref={imgRef}
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
        <div className={`flex items-center justify-center bg-zinc-700 text-zinc-400 ${
          isMasonry ? "aspect-square" : "absolute inset-0"
        }`}>
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {/* Video/GIF indicator */}
      {(isVideo || isAnimated) && (
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {isVideo ? "VIDEO" : "GIF"}
        </div>
      )}
    </Link>
  );
}
