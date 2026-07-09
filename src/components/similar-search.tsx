"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { PostCard } from "@/components/post-card";
import type { PostSummary } from "@/types/post";

interface SimilarResult extends PostSummary {
  id: number;
  distance: number;
}

interface SimilarSearchProps {
  initialHash?: string;
  initialThreshold: number;
}

export function SimilarSearch({ initialHash, initialThreshold }: SimilarSearchProps) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [sourceHash, setSourceHash] = useState(initialHash);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [results, setResults] = useState<SimilarResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort inflight search on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Search by hash via GET API. Promise-chain with the searching/error flags
  // set inside it (one microtask later) so the initial-search effect can call
  // this without setting state synchronously from the effect body.
  const searchByHash = useCallback((hash: string, thresh: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    return Promise.resolve()
      .then(() => {
        setIsSearching(true);
        setError(null);

        const params = new URLSearchParams({
          hash,
          threshold: String(thresh),
          limit: "40",
        });
        return fetch(`/api/similar?${params}`, { signal: controller.signal });
      })
      .then((response) =>
        response.json().then((data) => {
          if (!response.ok) {
            throw new Error(data.error || "Search failed");
          }
          setResults(data.results);
        })
      )
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed");
        setResults(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false);
      });
  }, []);

  // Search by uploaded file via POST API
  const searchByFile = useCallback(async (file: File, thresh: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("threshold", String(thresh));
      formData.append("limit", "40");

      const response = await fetch("/api/similar", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload search failed");
      }

      setResults(data.results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, []);

  // Run initial search if hash provided
  useEffect(() => {
    if (initialHash && /^[a-fA-F0-9]{64}$/.test(initialHash)) {
      searchByHash(initialHash, threshold);
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-search when threshold changes (debounced)
  const handleThresholdChange = useCallback((newThreshold: number) => {
    setThreshold(newThreshold);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (sourceHash) {
        searchByHash(sourceHash, newThreshold);
      } else if (lastUploadedFile) {
        searchByFile(lastUploadedFile, newThreshold);
      }
    }, 300);
  }, [sourceHash, lastUploadedFile, searchByHash, searchByFile]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setSourceHash(undefined);
    setLastUploadedFile(file);
    await searchByFile(file, threshold);
  }, [searchByFile, threshold]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  // Paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't hijack pastes aimed at an editable element (e.g. a search box on
      // the same page) - only handle "page-level" image pastes.
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleUpload(file);
            return;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleUpload]);

  return (
    <div className="space-y-4">
      {/* Threshold slider */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Threshold
        </label>
        {/* pHash distance is theoretically 0-64, but distances >32 rarely indicate visual similarity, so the slider is capped at 32 for a practical UX range */}
        <input
          type="range"
          min={1}
          max={32}
          value={threshold}
          onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
          className="flex-1 accent-blue-600"
        />
        <span className="w-8 text-center text-sm tabular-nums text-zinc-500">{threshold}</span>
      </div>

      {/* Drop zone */}
      <div
        tabIndex={0}
        role="button"
        aria-label="Upload image"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isSearching) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        }`}
      >
        <ArrowUpTrayIcon className={`h-8 w-8 ${isDragging ? "text-blue-500" : "text-zinc-400"}`} />
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {isSearching ? "Searching..." : "Drop an image, paste, or click to upload"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Results */}
      {isSearching && results === null && <ResultsSkeleton />}

      {results !== null && !isSearching && results.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
          <p className="text-zinc-500 dark:text-zinc-400">
            No similar images found. Try increasing the threshold.
          </p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {results.length} similar {results.length === 1 ? "image" : "images"}
            </h2>
            {isSearching && (
              <span className="text-sm text-zinc-400 animate-pulse">Updating...</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((result) => (
              <div key={result.hash} className="relative">
                <PostCard
                  hash={result.hash}
                  width={result.width}
                  height={result.height}
                  blurhash={result.blurhash}
                  mimeType={result.mimeType}
                  layout="grid"
                />
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white tabular-nums">
                  d={result.distance}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-40 rounded bg-zinc-300 dark:bg-zinc-700" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-zinc-300 dark:bg-zinc-700" />
        ))}
      </div>
    </div>
  );
}
