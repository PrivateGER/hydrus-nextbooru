"use client";

import { CheckCircleIcon, FingerPrintIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { PhashStats, ConfirmModalConfig } from "@/types/admin";

export interface PhashSectionProps {
  phashStats: PhashStats | null;
  isComputing: boolean;
  onCompute: () => void;
  onResetAll: () => void;
  openConfirmModal: (config: Omit<ConfirmModalConfig, "isOpen">) => void;
}

export function PhashSection({
  phashStats,
  isComputing,
  onCompute,
  onResetAll,
  openConfirmModal,
}: PhashSectionProps) {
  const allComplete = phashStats && phashStats.withoutPhash === 0;

  return (
    <div className="space-y-5">
      {phashStats && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Overview</h3>
            {allComplete && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> All hashed
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{phashStats.total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-emerald-400">{phashStats.withPhash.toLocaleString()}</p>
              <p className="text-xs text-emerald-400/60">Hashed</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-amber-400">{phashStats.withoutPhash.toLocaleString()}</p>
              <p className="text-xs text-amber-400/60">Pending</p>
            </div>
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{phashStats.unsupported.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Unsupported</p>
            </div>
          </div>

          {phashStats.batchRunning && phashStats.batchProgress && (
            <div className="mt-4 border-t border-zinc-300 dark:border-zinc-700 pt-4">
              <ProgressBar current={phashStats.batchProgress.processed} total={phashStats.batchProgress.total} color="purple" />
            </div>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">Compute Hashes</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Generate perceptual hashes for reverse image search. New images are hashed during sync automatically.
        </p>
        <Button
          onClick={onCompute}
          disabled={isComputing || (phashStats?.withoutPhash ?? 0) === 0}
          loading={isComputing}
          className="bg-purple-600 hover:bg-purple-500"
        >
          <FingerPrintIcon className="h-4 w-4" />
          Hash {phashStats?.withoutPhash?.toLocaleString() ?? 0}
        </Button>
      </Card>

      {(phashStats?.withPhash ?? 0) > 0 && (
        <Card className="border-red-500/20">
          <h3 className="mb-2 font-medium text-red-500 dark:text-red-400">Danger Zone</h3>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Delete all perceptual hashes. They&apos;ll be recomputed during next sync or batch run.</p>
          <Button
            onClick={() =>
              openConfirmModal({
                title: "Delete all perceptual hashes?",
                message: `This will remove ${phashStats?.withPhash.toLocaleString()} hashes. They will be recomputed during next sync.`,
                confirmText: "Delete All",
                confirmVariant: "danger",
                onConfirm: onResetAll,
              })
            }
            disabled={isComputing}
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
