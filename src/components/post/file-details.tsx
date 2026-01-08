"use client";

import { DownloadButton } from "@/components/download-button";

interface FileDetailsProps {
  hash: string;
  extension: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  duration: number | null;
  hasAudio: boolean;
  importedAt: Date;
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

export function FileDetails({
  hash,
  extension,
  mimeType,
  width,
  height,
  fileSize,
  duration,
  hasAudio,
  importedAt,
  downloadFilename,
}: FileDetailsProps) {
  return (
    <details className="group rounded-lg bg-zinc-200 dark:bg-zinc-800">
      <summary className="cursor-pointer p-4 text-lg font-semibold hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <svg
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="flex-1">File Details</span>
        <DownloadButton hash={hash} extension={extension} filename={downloadFilename} />
      </summary>
      <dl className="grid grid-cols-2 gap-2 px-4 pb-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Type</dt>
          <dd>{mimeType}</dd>
        </div>
        {width && height && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Dimensions</dt>
            <dd>{width} x {height}</dd>
          </div>
        )}
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Size</dt>
          <dd>{formatFileSize(fileSize)}</dd>
        </div>
        {duration && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Duration</dt>
            <dd>{formatDuration(duration)}</dd>
          </div>
        )}
        {hasAudio && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Audio</dt>
            <dd>Yes</dd>
          </div>
        )}
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Imported</dt>
          <dd>{importedAt.toLocaleDateString()}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Hash</dt>
          <dd className="font-mono text-xs break-all">{hash}</dd>
        </div>
      </dl>
    </details>
  );
}
