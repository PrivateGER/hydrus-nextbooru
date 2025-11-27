"use client";

import { DownloadButton } from "@/components/download-button";

interface QuickInfoBarProps {
  hash: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  duration: number | null;
  downloadFilename: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getMediaType(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "image/gif") return "GIF";
  if (mimeType.startsWith("image/")) return "IMAGE";
  return mimeType.split("/")[1]?.toUpperCase() || "FILE";
}

function getMediaTypeColor(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "bg-purple-900/50 text-purple-300";
  if (mimeType === "image/gif") return "bg-green-900/50 text-green-300";
  return "bg-zinc-700 text-zinc-300";
}

export function QuickInfoBar({
  hash,
  mimeType,
  width,
  height,
  fileSize,
  duration,
  downloadFilename,
}: QuickInfoBarProps) {
  const mediaType = getMediaType(mimeType);
  const mediaTypeColor = getMediaTypeColor(mimeType);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-800 p-3">
      {/* Media type badge */}
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${mediaTypeColor}`}>
        {mediaType}
      </span>

      {/* Dimensions */}
      {width && height && (
        <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
          {width} x {height}
        </span>
      )}

      {/* File size */}
      <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
        {formatFileSize(fileSize)}
      </span>

      {/* Duration (for videos) */}
      {duration && (
        <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
          {formatDuration(duration)}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download button - icon only on mobile, with text on desktop */}
      <DownloadButton
        hash={hash}
        filename={downloadFilename}
        showTextOnLg
      />
    </div>
  );
}
