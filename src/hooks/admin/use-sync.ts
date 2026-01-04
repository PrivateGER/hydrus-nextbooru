"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync");
      const data = await response.json();
      if (mountedRef.current) {
        setSyncStatus(data);
        setIsSyncing(data.status === "running");
      }
    } catch (error) {
      console.error("Error fetching sync status:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

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

      // Start polling for completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch("/api/admin/sync");
          const statusData = await statusResponse.json();

          if (!mountedRef.current) return;

          setSyncStatus(statusData);

          if (statusData.status !== "running") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsSyncing(false);

            if (statusData.status === "completed") {
              triggerSuccessAnimation();
              setMessage({
                type: "success",
                text: `Sync completed! ${statusData.lastSyncCount.toLocaleString()} files imported.`,
              });
            } else if (statusData.status === "cancelled") {
              setMessage({
                type: "success",
                text: `Sync cancelled. ${statusData.processedFiles.toLocaleString()} files were imported.`,
              });
            } else if (statusData.status === "error") {
              setMessage({
                type: "error",
                text: `Sync failed: ${statusData.errorMessage}`,
              });
            }
          }
        } catch (error) {
          console.error("Error polling sync status:", error);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (mountedRef.current) {
            setIsSyncing(false);
            setMessage({
              type: "error",
              text: "Failed to check sync status",
            });
          }
        }
      }, 2000);
    } catch (error) {
      setIsSyncing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start sync",
      });
    }
  }, [setMessage, triggerSuccessAnimation]);

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
