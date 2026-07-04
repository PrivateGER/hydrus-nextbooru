"use client";

import { useState } from "react";
import { DocumentMagnifyingGlassIcon, StopIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { OcrStats } from "@/types/admin";

export interface OcrSectionProps {
  ocrStats: OcrStats | null;
  isRunning: boolean;
  onStart: (options: { limit?: number; tags?: string[]; retryFailed?: boolean }) => void;
  onCancel: () => void;
}

export function OcrSection({ ocrStats, isRunning, onStart, onCancel }: OcrSectionProps) {
  const [limitInput, setLimitInput] = useState("500");
  const [tagsInput, setTagsInput] = useState("");
  const [retryFailed, setRetryFailed] = useState(false);

  if (ocrStats && !ocrStats.enabled) {
    return (
      <Card>
        <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">OCR not configured</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set <code>OCR_SERVICE_URL</code> and run the manga-image-translator sidecar (see
          docker-compose.yml) to enable positioned text recognition.
        </p>
      </Card>
    );
  }

  const handleStart = () => {
    const limit = Number.parseInt(limitInput, 10);
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onStart({
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      tags: tags.length > 0 ? tags : undefined,
      retryFailed,
    });
  };

  return (
    <div className="space-y-5">
      {ocrStats && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Text recognition</h3>
            <span
              className={`text-xs ${ocrStats.serviceReachable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {ocrStats.serviceReachable ? "service reachable" : "service unreachable"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{ocrStats.pendingImages}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">pending images</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{ocrStats.completeImages}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">scanned</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{ocrStats.failedImages}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{ocrStats.totalRegions}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">text regions</p>
            </div>
          </div>

          {isRunning && (
            <div className="mt-4 border-t border-zinc-300 dark:border-zinc-700 pt-4">
              <ProgressBar
                current={ocrStats.batch.processedPosts + ocrStats.batch.failedPosts}
                total={ocrStats.batch.totalPosts}
                color="purple"
              />
            </div>
          )}
          {ocrStats.batch.errorMessage && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{ocrStats.batch.errorMessage}</p>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">Batch scan</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          OCR runs serially through the sidecar (~2–10s per page); translations run in parallel.
          Interactive scans queue behind a running batch.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Limit</span>
            <Input
              type="number"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="w-28"
              disabled={isRunning}
            />
          </label>
          <label className="block flex-1 min-w-48">
            <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              Tags filter (comma-separated, all must match)
            </span>
            <Input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. comic, japanese"
              disabled={isRunning}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={retryFailed}
              onChange={(e) => setRetryFailed(e.target.checked)}
              disabled={isRunning}
            />
            retry failed
          </label>
          {isRunning ? (
            <Button onClick={onCancel} variant="danger">
              <StopIcon className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={!ocrStats}>
              <DocumentMagnifyingGlassIcon className="h-4 w-4" />
              Start batch
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
