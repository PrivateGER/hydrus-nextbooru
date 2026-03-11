"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { PostCard } from "@/components/post-card";

interface UploadResult {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  distance: number;
}

interface SimilarSearchUploadProps {
  initialThreshold: number;
}

export function SimilarSearchUpload({ initialThreshold }: SimilarSearchUploadProps) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("threshold", String(threshold));
      formData.append("limit", "40");

      const response = await fetch("/api/similar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload search failed");
      }

      setUploadResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [threshold]);

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
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  return (
    <div className="space-y-4">
      {/* Threshold slider */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Threshold
        </label>
        <input
          type="range"
          min={1}
          max={32}
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
          className="flex-1 accent-blue-600"
        />
        <span className="w-8 text-center text-sm tabular-nums text-zinc-500">{threshold}</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        }`}
      >
        <ArrowUpTrayIcon className={`h-8 w-8 ${isDragging ? "text-blue-500" : "text-zinc-400"}`} />
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {isUploading ? "Searching..." : "Drop an image or click to upload"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Upload search results */}
      {uploadResults !== null && (
        <div>
          {uploadResults.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              No similar images found. Try increasing the threshold.
            </p>
          ) : (
            <>
              <h2 className="mb-3 text-lg font-semibold">
                {uploadResults.length} similar {uploadResults.length === 1 ? "image" : "images"}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {uploadResults.map((result) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
