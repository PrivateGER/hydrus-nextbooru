"use client";

import Link from "next/link";
import { useState } from "react";
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

export function PostCard({ hash, width, height, blurhash, mimeType, layout = "masonry" }: PostCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

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
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
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
