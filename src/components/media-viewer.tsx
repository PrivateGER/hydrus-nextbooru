"use client";

import Link from "next/link";

interface MediaViewerProps {
  hash: string;
  mimeType: string;
  prevPostHash?: string;
  nextPostHash?: string;
}

export function MediaViewer({
  hash,
  mimeType,
  prevPostHash,
  nextPostHash,
}: MediaViewerProps) {
  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");
  const hasNavigation = prevPostHash !== undefined || nextPostHash !== undefined;

  return (
    <div className="group relative inline-block rounded-lg bg-zinc-800">
      {/* Previous button */}
      {prevPostHash !== undefined && (
        <Link
          href={`/post/${prevPostHash}`}
          className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
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
          src={`/api/files/${hash}`}
          controls
          autoPlay
          loop
          className="max-h-[85vh] max-w-full rounded"
        >
          Your browser does not support the video tag.
        </video>
      ) : isImage ? (
        <a href={`/api/files/${hash}`} target="_blank" rel="noopener noreferrer">
          <img
            src={`/api/files/${hash}`}
            alt=""
            className="max-h-[85vh] max-w-full rounded"
          />
        </a>
      ) : (
        <div className="flex h-64 items-center justify-center text-zinc-400">
          <p>Preview not available for {mimeType}</p>
        </div>
      )}

      {/* Next button */}
      {nextPostHash !== undefined && (
        <Link
          href={`/post/${nextPostHash}`}
          className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
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
      {hasNavigation && (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
          {prevPostHash === undefined ? "First" : nextPostHash === undefined ? "Last" : ""}
        </div>
      )}
    </div>
  );
}
