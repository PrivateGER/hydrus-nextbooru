"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { BlurhashImage } from "./blurhash-image";

interface ThumbnailCardProps {
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  /** Tailwind height class (e.g., "h-24", "h-36") */
  heightClass?: string;
  /** Show VIDEO/GIF badge for media types */
  showMediaBadge?: boolean;
  /** Additional content overlays (e.g., position badges) */
  children?: ReactNode;
  /** Additional classes for the container */
  className?: string;
}

/**
 * Reusable thumbnail component with blurhash loading, media badges, and fade-in.
 * Does not include Link wrapper - parent component handles navigation.
 */
export function ThumbnailCard({
  hash,
  width,
  height,
  blurhash,
  mimeType,
  heightClass = "h-24",
  showMediaBadge = true,
  children,
  className = "",
}: ThumbnailCardProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const isVideo = mimeType.startsWith("video/");
  const isAnimated = mimeType === "image/gif" || mimeType === "image/apng";

  // Check if already cached on mount
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [hash]);

  // Reset loaded state when hash changes
  useEffect(() => {
    setLoaded(false);
  }, [hash]);

  const aspectRatio = width && height ? `${width} / ${height}` : "1";

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blurhash placeholder */}
      {!loaded && blurhash && width && height && (
        <div className="absolute inset-0">
          <BlurhashImage
            blurhash={blurhash}
            width={width}
            height={height}
            className="h-full w-full"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
          </div>
        </div>
      )}

      {/* Fallback placeholder (no blurhash) */}
      {!loaded && (!blurhash || !width || !height) && (
        <div
          className={`flex items-center justify-center bg-zinc-700 ${heightClass} w-auto`}
          style={{ aspectRatio }}
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
        </div>
      )}

      {/* Actual thumbnail */}
      <img
        ref={imgRef}
        src={`/api/thumbnails/${hash}.webp`}
        alt=""
        className={`${heightClass} w-auto transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ aspectRatio }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />

      {/* Video/GIF indicator */}
      {showMediaBadge && (isVideo || isAnimated) && (
        <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {isVideo ? "VIDEO" : "GIF"}
        </div>
      )}

      {/* Custom overlays from parent */}
      {children}
    </div>
  );
}
