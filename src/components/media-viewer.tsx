"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { decode } from "blurhash";
import { TextOverlay, type OverlayRegion } from "@/components/post/text-overlay";

interface MediaViewerProps {
  hash: string;
  extension: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  /** Full destination URL for the previous post (may carry ?in= group context). */
  prevUrl?: string;
  /** Full destination URL for the next post (may carry ?in= group context). */
  nextUrl?: string;
  currentPosition?: number;
  totalCount?: number;
  textRegions?: OverlayRegion[];
  ocrEnabled?: boolean;
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
 * @param prevUrl - Optional URL for the previous post; when provided shows a previous navigation control and enables swipe-right navigation
 * @param nextUrl - Optional URL for the next post; when provided shows a next navigation control and enables swipe-left navigation
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
  prevUrl,
  nextUrl,
  currentPosition,
  totalCount,
  textRegions,
  ocrEnabled,
}: MediaViewerProps) {
  return (
    <MediaViewerContent
      key={hash}
      hash={hash}
      extension={extension}
      mimeType={mimeType}
      width={width}
      height={height}
      blurhash={blurhash}
      prevUrl={prevUrl}
      nextUrl={nextUrl}
      currentPosition={currentPosition}
      totalCount={totalCount}
      textRegions={textRegions}
      ocrEnabled={ocrEnabled}
    />
  );
}

function MediaViewerContent({
  hash,
  extension,
  mimeType,
  width,
  height,
  blurhash,
  prevUrl,
  nextUrl,
  currentPosition,
  totalCount,
  textRegions,
  ocrEnabled,
}: MediaViewerProps) {
  const router = useRouter();
  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");
  const hasNavigation = prevUrl !== undefined || nextUrl !== undefined;

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [showBlurhash, setShowBlurhash] = useState(false);
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const fullRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video on navigation (handles Activity route caching, bfcache, tab
  // switches, and unmount). With cacheComponents enabled, Next.js keeps
  // navigated-away pages mounted in a hidden <Activity>; useLayoutEffect (not
  // useEffect) guarantees the cleanup pause runs synchronously when the route
  // is hidden — passive-effect cleanup can be deferred by a re-suspending
  // Suspense boundary or a View Transition, leaving the hidden video audible.
  // See https://react.dev/reference/react/Activity#my-hidden-components-have-unwanted-side-effects
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly start playback - autoPlay attribute doesn't reliably trigger
    // after pause() was called on the same element during cleanup
    video.play().catch(() => {
      // Autoplay blocked by browser policy (user hasn't interacted yet)
    });

    // pagehide fires BEFORE page enters bfcache - critical for back button
    const handlePageHide = () => video.pause();

    // visibilitychange catches tab switches and some navigations
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        video.pause();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      video.pause();
    };
  }, [hash]);

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
      if (deltaX < 0 && nextUrl) {
        router.push(nextUrl);
      } else if (deltaX > 0 && prevUrl) {
        router.push(prevUrl);
      }
    }
    swipeStartRef.current = null;
  };

  const handlePointerCancel = () => {
    swipeStartRef.current = null;
  };

  // When Post.width/height are unknown, derive the display aspect ratio from
  // the first image that paints so overlay percentages map to the image
  // itself, not the 16/9 letterboxed container.
  const measureRatio = (img: HTMLImageElement) => {
    if ((!width || !height) && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setMeasuredRatio(img.naturalWidth / img.naturalHeight);
    }
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

  // Loading states reset naturally because MediaViewerContent is keyed by hash.
  useEffect(() => {
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

        // onLoad does not re-fire for images already cached at mount, so
        // derive the ratio here as well when dimensions are unknown.
        if (!width || !height) {
          const measured = fullCached
            ? fullRef.current
            : previewCached
              ? previewRef.current
              : null;
          if (measured && measured.naturalWidth > 0 && measured.naturalHeight > 0) {
            setMeasuredRatio(measured.naturalWidth / measured.naturalHeight);
          }
        }

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
  }, [hash, width, height]);

  // Calculate aspect ratio for stable container sizing
  const aspectRatio = width && height ? width / height : measuredRatio ?? 16 / 9;

  return (
    <div
      className="vt-media-viewer group relative inline-block rounded-lg bg-zinc-200 dark:bg-zinc-800 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Previous button */}
      {prevUrl !== undefined && (
        <Link
          href={prevUrl}
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

      {/* Media content. The video carries no autoPlay attribute: playback is
          started exclusively by the layout effect above. The attribute lets
          the BROWSER start playback on its own when data arrives — including
          on a navigated-away page kept alive in a hidden Activity, which
          plays audio from offscreen. The effect's explicit play()/pause()
          stays in control instead. */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={`/api/files/${hash}${extension}`}
          controls
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
            onLoad={(e) => {
              setPreviewLoaded(true);
              measureRatio(e.currentTarget);
            }}
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
            onLoad={(e) => {
              setFullLoaded(true);
              measureRatio(e.currentTarget);
            }}
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

      {isImage && ((width && height) || measuredRatio) && (
        <TextOverlay
          hash={hash}
          initialRegions={textRegions ?? []}
          ocrEnabled={ocrEnabled ?? false}
        />
      )}

      {/* Next button */}
      {nextUrl !== undefined && (
        <Link
          href={nextUrl}
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
