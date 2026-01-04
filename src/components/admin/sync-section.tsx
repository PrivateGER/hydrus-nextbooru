"use client";

import { CloudArrowDownIcon, PlayIcon, StopIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { InfoBox } from "@/components/ui/info-box";
import { StatusBadge } from "./status-badge";
import type { SyncStatus } from "@/types/admin";

export interface SyncSectionProps {
  syncStatus: SyncStatus | null;
  isSyncing: boolean;
  customTags: string;
  onCustomTagsChange: (tags: string) => void;
  onFullSync: () => void;
  onCustomSync: () => void;
  onCancelSync: () => void;
  formatDate: (dateString: string | null) => string;
}

export function SyncSection({
  syncStatus,
  isSyncing,
  customTags,
  onCustomTagsChange,
  onFullSync,
  onCustomSync,
  onCancelSync,
  formatDate,
}: SyncSectionProps) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${syncStatus?.status === "running" ? "bg-blue-500/10" : "bg-zinc-700"}`}>
              <CloudArrowDownIcon className={`h-5 w-5 ${syncStatus?.status === "running" ? "text-blue-400" : "text-zinc-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={syncStatus?.status} />
                {syncStatus?.lastSyncedAt && (
                  <span className="text-xs text-zinc-500">{formatDate(syncStatus.lastSyncedAt)}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-zinc-400">
                {syncStatus?.lastSyncCount ? `${syncStatus.lastSyncCount.toLocaleString()} files synced` : "No syncs yet"}
              </p>
            </div>
          </div>
          {syncStatus?.status !== "running" && (
            <Button onClick={onFullSync} disabled={isSyncing} tooltip="Import all files from Hydrus">
              <PlayIcon className="h-4 w-4" />
              Start Sync
            </Button>
          )}
        </div>

        {syncStatus?.status === "running" && syncStatus.totalFiles > 0 && (
          <div className="mt-4 space-y-3 border-t border-zinc-700 pt-4">
            <ProgressBar current={syncStatus.processedFiles} total={syncStatus.totalFiles} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Batch {syncStatus.currentBatch} of {syncStatus.totalBatches}
              </span>
              <Button onClick={onCancelSync} variant="danger" tooltip="Stop after current batch">
                <StopIcon className="h-4 w-4" />
                Stop
              </Button>
            </div>
          </div>
        )}

        {syncStatus?.errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            <XCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p>{syncStatus.errorMessage}</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Sync by Tags</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input
              value={customTags}
              onChange={(e) => onCustomTagsChange(e.target.value)}
              placeholder="character:samus, creator:artist"
              disabled={isSyncing}
              hint="Separate tags with commas"
            />
          </div>
          <Button onClick={onCustomSync} disabled={isSyncing || !customTags.trim()} variant="secondary" className="sm:self-start">
            Sync
          </Button>
        </div>
      </Card>

      <InfoBox variant="note">
        Syncing imports metadata only. Files stay in Hydrus and are served directly from there.
      </InfoBox>
    </div>
  );
}
