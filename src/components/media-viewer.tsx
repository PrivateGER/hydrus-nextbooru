"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { decode } from "blurhash";

interface MediaViewerProps {
  hash: string;
  extension: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  prevPostHash?: string;
  nextPostHash?: string;
  currentPosition?: number;
  totalCount?: number;
}

/**
 * Renders a media viewer for images or videos with blurhash and thumbnail placeholders, plus optional previous/next navigation and touch swipe support.
 *
 * @param hash - Unique file identifier used to build media URLs
 * @param extension - File extension (including leading dot) appended to the file URL
 * @param mimeType - MIME type that determines whether an image or video element is rendered
 * @param width - Optional intrinsic image width used to calculate aspect ratio and sizing
 * @param height - Optional intrinsic image height used to calculate aspect ratio and sizing
 * @param blurhash - Optional blurhash string rendered to a canvas as a low-resolution placeholder until the preview/full image loads
 * @param prevPostHash - Optional hash for the previous post; when provided shows a previous navigation control and enables swipe-right navigation
 * @param nextPostHash - Optional hash for the next post; when provided shows a next navigation control and enables swipe-left navigation
 * @param currentPosition - Optional 1-based position of current post in the group
 * @param totalCount - Optional total number of posts in the group
 * @returns The React element representing the media viewer
 */
export function MediaViewer({
  hash,
  extension,
  mimeType,
  width,
  height,
  blurhash,
  prevPostHash,
  nextPostHash,
  currentPosition,
  totalCount,
}: MediaViewerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");
  const hasNavigation = prevPostHash !== undefined || nextPostHash !== undefined;

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [showBlurhash, setShowBlurhash] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const fullRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video on unmount, route change, or hash change
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
    };
  }, [hash, pathname]);

  // Handle swipe navigation for touch devices
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (ignore multi-touch)
    if (!e.isPrimary) return;

    // Only handle touch and pen, not mouse
    if (e.pointerType === "mouse") return;

    // Ignore if touching video (for native controls) or nav buttons
    const target = e.target as HTMLElement;
    if (target.closest("video, [aria-label]")) return;

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // Only handle primary pointer
    if (!e.isPrimary) return;

    if (!swipeStartRef.current) return;

    const deltaX = e.clientX - swipeStartRef.current.x;
    const deltaY = e.clientY - swipeStartRef.current.y;

    // Only trigger if horizontal swipe > threshold and more horizontal than vertical
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0 && nextPostHash) {
        router.push(`/post/${nextPostHash}`);
      } else if (deltaX > 0 && prevPostHash) {
        router.push(`/post/${prevPostHash}`);
      }
    }
    swipeStartRef.current = null;
  };

  const handlePointerCancel = () => {
    swipeStartRef.current = null;
  };

  // Render blurhash to canvas
  useEffect(() => {
    if (!blurhash || !canvasRef.current) return;
    try {
      const pixels = decode(blurhash, 32, 32);
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Invalid blurhash
    }
  }, [blurhash]);

  // Reset loading states when hash changes
  useEffect(() => {
    setPreviewLoaded(false);
    setFullLoaded(false);
    setShowBlurhash(false);

    let rafId2: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    // Double rAF ensures DOM has updated with new src before checking cache
    const rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        // Check if images are already loaded (cached)
        const previewCached =
          previewRef.current?.complete && previewRef.current.naturalWidth > 0;
        const fullCached =
          fullRef.current?.complete && fullRef.current.naturalWidth > 0;

        if (previewCached) setPreviewLoaded(true);
        if (fullCached) setFullLoaded(true);

        // Only show blurhash after 100ms if images aren't already loaded
        if (!previewCached && !fullCached) {
          timerId = setTimeout(() => setShowBlurhash(true), 100);
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (timerId) clearTimeout(timerId);
    };
  }, [hash]);

  // Calculate aspect ratio for stable container sizing
  const aspectRatio = width && height ? width / height : 16 / 9;

  return (
    <div
      className="group relative inline-block rounded-lg bg-zinc-200 dark:bg-zinc-800 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Previous button */}
      {prevPostHash !== undefined && (
        <Link
          href={`/post/${prevPostHash}`}
          className="absolute left-2 lg:left-4 top-1/2 z-10 flex h-10 w-10 lg:h-12 lg:w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 lg:opacity-0 lg:group-hover:opacity-100"
          aria-label="Previous image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
      )}

      {/* Media content */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={`/api/files/${hash}${extension}`}
          controls
          autoPlay
          loop
          className="max-h-[85vh] max-w-full rounded"
        >
          Your browser does not support the video tag.
        </video>
      ) : isImage ? (
        <a
          href={`/api/files/${hash}${extension}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block overflow-hidden rounded"
          style={{
            maxHeight: "85vh",
            maxWidth: "100%",
            aspectRatio: `${aspectRatio}`,
            width: width && height ? `min(100%, min(85vh * ${aspectRatio}, ${width}px))` : "auto",
          }}
        >
          {/* Layer 1: Blurhash placeholder (delayed 100ms to avoid flash on fast loads) */}
          {blurhash && (
            <canvas
              ref={canvasRef}
              width={32}
              height={32}
              className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                showBlurhash && !previewLoaded && !fullLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* Layer 2: Preview thumbnail (600px) */}
          <img
            ref={previewRef}
            src={`/api/thumbnails/${hash}.webp?size=preview`}
            alt=""
            onLoad={() => setPreviewLoaded(true)}
            onError={() => setPreviewLoaded(true)}
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              previewLoaded && !fullLoaded ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Layer 3: Full resolution image */}
          <img
            ref={fullRef}
            src={`/api/files/${hash}${extension}`}
            alt=""
            onLoad={() => setFullLoaded(true)}
            onError={() => setFullLoaded(true)}
            className={`h-full w-full object-contain transition-opacity duration-300 ${
              fullLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </a>
      ) : (
        <div className="flex h-64 items-center justify-center text-zinc-500 dark:text-zinc-400">
          <p>Preview not available for {mimeType}</p>
        </div>
      )}

      {/* Next button */}
      {nextPostHash !== undefined && (
        <Link
          href={`/post/${nextPostHash}`}
          className="absolute right-2 lg:right-4 top-1/2 z-10 flex h-10 w-10 lg:h-12 lg:w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 lg:opacity-0 lg:group-hover:opacity-100"
          aria-label="Next image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </Link>
      )}

      {/* Position indicator (shows on hover when in group) */}
      {hasNavigation && currentPosition !== undefined && totalCount !== undefined && (
        <div className="absolute bottom-2 lg:bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white lg:opacity-0 transition-opacity lg:group-hover:opacity-100">
          {currentPosition}/{totalCount}
        </div>
      )}
    </div>
  );
}
