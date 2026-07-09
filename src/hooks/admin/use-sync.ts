"use client";

import { useState, useCallback, useEffect } from "react";
import { useBatchPolling } from "./use-batch-polling";
import type { SyncStatus, Message } from "@/types/admin";

export interface UseSyncReturn {
  syncStatus: SyncStatus | null;
  isSyncing: boolean;
  isLoading: boolean;
  fetchStatus: () => Promise<void>;
  startSync: (tags?: string[]) => Promise<void>;
  cancelSync: () => Promise<void>;
}

export function useSync(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { mountedRef, startPolling } = useBatchPolling<SyncStatus>({
    url: "/api/admin/sync",
    onData: setSyncStatus,
    isActive: (data) => data.status === "running",
    onStop: (data) => {
      setIsSyncing(false);

      if (data.status === "completed") {
        triggerSuccessAnimation();
        setMessage({
          type: "success",
          text: `Sync completed! ${data.lastSyncCount.toLocaleString()} files imported.`,
        });
      } else if (data.status === "cancelled") {
        setMessage({
          type: "success",
          text: `Sync cancelled. ${data.processedFiles.toLocaleString()} files were imported.`,
        });
      } else if (data.status === "error") {
        setMessage({
          type: "error",
          text: data.errorMessage ? `Sync failed: ${data.errorMessage}` : "Sync failed",
        });
      }
    },
    onPollError: () => {
      setIsSyncing(false);
      setMessage({
        type: "error",
        text: "Failed to check sync status",
      });
    },
  });

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync");
      const data = await response.json();
      if (mountedRef.current) {
        setSyncStatus(data);
        setIsSyncing(data.status === "running");
        // Resume live updates if a sync was already running when this mounted.
        if (data.status === "running") startPolling();
      }
    } catch (error) {
      console.error("Error fetching sync status:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [mountedRef, startPolling]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startSync = useCallback(async (tags?: string[]) => {
    setIsSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start sync");
      }

      setMessage({ type: "success", text: "Sync started! You can monitor progress below." });
      startPolling();
    } catch (error) {
      setIsSyncing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start sync",
      });
    }
  }, [setMessage, startPolling]);

  const cancelSync = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync", { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel sync");
      }

      setMessage({ type: "success", text: "Stopping sync after current batch..." });
      await fetchStatus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel sync",
      });
    }
  }, [setMessage, fetchStatus]);

  return {
    syncStatus,
    isSyncing,
    isLoading,
    fetchStatus,
    startSync,
    cancelSync,
  };
}
