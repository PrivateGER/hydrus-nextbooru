"use client";

import { ArrowPathIcon, CheckCircleIcon, PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ThumbnailStats, ConfirmModalConfig } from "@/types/admin";

export interface ThumbnailsSectionProps {
  thumbStats: ThumbnailStats | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onResetFailed: () => void;
  onClearAll: () => void;
  openConfirmModal: (config: Omit<ConfirmModalConfig, "isOpen">) => void;
}

export function ThumbnailsSection({
  thumbStats,
  isGenerating,
  onGenerate,
  onResetFailed,
  onClearAll,
  openConfirmModal,
}: ThumbnailsSectionProps) {
  const allComplete = thumbStats && thumbStats.pending === 0 && thumbStats.failed === 0;
  const hasIssues = (thumbStats?.failed ?? 0) > 0 || (thumbStats?.unsupported ?? 0) > 0;

  return (
    <div className="space-y-5">
      {thumbStats && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Overview</h3>
            {allComplete && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> All ready
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{thumbStats.total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-amber-400">{thumbStats.pending.toLocaleString()}</p>
              <p className="text-xs text-amber-400/60">Pending</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-emerald-400">{thumbStats.complete.toLocaleString()}</p>
              <p className="text-xs text-emerald-400/60">Complete</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-red-400">{thumbStats.failed.toLocaleString()}</p>
              <p className="text-xs text-red-400/60">Failed</p>
            </div>
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{thumbStats.unsupported.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Unsupported</p>
            </div>
          </div>

          {thumbStats.batchRunning && thumbStats.batchProgress && (
            <div className="mt-4 border-t border-zinc-300 dark:border-zinc-700 pt-4">
              <ProgressBar current={thumbStats.batchProgress.processed} total={thumbStats.batchProgress.total} color="purple" />
            </div>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">Generate Thumbnails</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Pre-generate thumbnails for faster browsing. They&apos;re also created on-demand.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onGenerate}
            disabled={isGenerating || (thumbStats?.pending ?? 0) === 0}
            loading={isGenerating}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <PhotoIcon className="h-4 w-4" />
            Generate {thumbStats?.pending?.toLocaleString() ?? 0}
          </Button>
          {hasIssues && (
            <Button onClick={onResetFailed} disabled={isGenerating} variant="secondary">
              <ArrowPathIcon className="h-4 w-4" />
              Retry Failed
            </Button>
          )}
        </div>
      </Card>

      {(thumbStats?.complete ?? 0) > 0 && (
        <Card className="border-red-500/20">
          <h3 className="mb-2 font-medium text-red-500 dark:text-red-400">Danger Zone</h3>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Delete all thumbnails. They&apos;ll need to be regenerated.</p>
          <Button
            onClick={() =>
              openConfirmModal({
                title: "Delete all thumbnails?",
                message: `This will remove ${thumbStats?.complete.toLocaleString()} thumbnails.`,
                confirmText: "Delete All",
                confirmVariant: "danger",
                onConfirm: onClearAll,
              })
            }
            disabled={isGenerating}
            variant="danger"
          >
            <TrashIcon className="h-4 w-4" />
            Clear All
          </Button>
        </Card>
      )}
    </div>
  );
}
