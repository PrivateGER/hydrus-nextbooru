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
  const imgRef = useRef<HTMLImageElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const hashShort = hash.slice(0, 8);

  // Reset state when hash changes (component reuse in virtualized lists)
  useEffect(() => {
    console.log(`[${hashShort}] hash changed, resetting state`);
    setLoaded(false);
    setError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [hash, hashShort]);

  // Track mounted state to prevent setState after unmount
  useEffect(() => {
    console.log(`[${hashShort}] mounted`);
    mountedRef.current = true;
    return () => {
      console.log(`[${hashShort}] unmounting`);
      mountedRef.current = false;
    };
  }, [hashShort]);

  // Use IntersectionObserver to detect when image enters viewport
  // Only then check for cached images and start timeout
  useEffect(() => {
    const img = imgRef.current;
    if (!img) {
      console.log(`[${hashShort}] no img ref`);
      return;
    }

    console.log(`[${hashShort}] setting up IntersectionObserver, img.complete=${img.complete}, img.naturalWidth=${img.naturalWidth}`);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        console.log(`[${hashShort}] intersection: isIntersecting=${entry.isIntersecting}, img.complete=${img.complete}, img.naturalWidth=${img.naturalWidth}`);

        if (!entry.isIntersecting) return;

        // Image is now visible - check if already cached
        if (img.complete && img.naturalWidth > 0) {
          console.log(`[${hashShort}] already complete, setting loaded=true`);
          if (mountedRef.current) setLoaded(true);
          observer.disconnect();
          return;
        }

        // Start timeout only when image enters viewport
        // This prevents false errors for lazy-loaded below-fold images
        if (!timeoutRef.current) {
          console.log(`[${hashShort}] starting ${LOAD_TIMEOUT_MS}ms timeout`);
          timeoutRef.current = setTimeout(() => {
            console.log(`[${hashShort}] timeout fired, mounted=${mountedRef.current}, loaded=${loaded}`);
            if (mountedRef.current && !loaded) {
              console.log(`[${hashShort}] setting error=true due to timeout`);
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
      console.log(`[${hashShort}] cleanup: disconnecting observer`);
      observer.disconnect();
      if (timeoutRef.current) {
        console.log(`[${hashShort}] cleanup: clearing timeout`);
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hash, hashShort, loaded]);

  // Handle successful load
  const handleLoad = () => {
    const img = imgRef.current;
    console.log(`[${hashShort}] onLoad fired, mounted=${mountedRef.current}, img.complete=${img?.complete}, img.naturalWidth=${img?.naturalWidth}`);
    if (!mountedRef.current) return;
    setLoaded(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  // Handle load error
  const handleError = () => {
    console.log(`[${hashShort}] onError fired, mounted=${mountedRef.current}`);
    if (!mountedRef.current) return;
    setError(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  // Log state changes
  useEffect(() => {
    console.log(`[${hashShort}] state: loaded=${loaded}, error=${error}`);
  }, [hashShort, loaded, error]);

  const isVideo = mimeType.startsWith("video/");
  const isAnimated = mimeType === "image/gif" || mimeType === "image/apng";

  const isMasonry = layout === "masonry";

  return (
    <Link
      href={`/post/${hash}`}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-800 transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 ${
        isMasonry ? "mb-3 break-inside-avoid" : ""
      }`}
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
        <img
          key={hash}
          ref={imgRef}
          src={`/api/thumbnails/${hash}.webp`}
          alt=""
          className={
            isMasonry
              ? `w-full h-auto transition-opacity duration-300 ${
                  loaded ? "opacity-100" : "absolute inset-0 opacity-0"
                }`
              : `absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`
          }
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
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
