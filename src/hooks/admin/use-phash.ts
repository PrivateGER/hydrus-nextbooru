"use client";

import { useState, useCallback, useEffect } from "react";
import { useBatchPolling } from "./use-batch-polling";
import type { PhashStats, Message } from "@/types/admin";

export interface UsePhashReturn {
  phashStats: PhashStats | null;
  isComputing: boolean;
  fetchStats: () => Promise<void>;
  computePhashes: () => Promise<void>;
  resetAll: () => Promise<void>;
}

export function usePhash(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UsePhashReturn {
  const [phashStats, setPhashStats] = useState<PhashStats | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const { mountedRef, startPolling } = useBatchPolling<PhashStats>({
    url: "/api/admin/phash",
    onData: setPhashStats,
    isActive: (data) => data.batchRunning,
    onStop: (data) => {
      setIsComputing(false);
      if (data.batchStatus === "failed") {
        setMessage({
          type: "error",
          text: data.batchError || "Phash computation failed",
        });
        return;
      }
      triggerSuccessAnimation();
      setMessage({
        type: "success",
        text: `Done! ${data.withPhash.toLocaleString()} images hashed.`,
      });
    },
    onPollError: () => {
      setIsComputing(false);
      setMessage({
        type: "error",
        text: "Failed to check phash computation status",
      });
    },
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/phash");
      if (!response.ok) return;
      const data = await response.json();
      if (mountedRef.current) {
        setPhashStats(data);
        setIsComputing(data.batchRunning);
        // Resume live updates if a batch was already running (e.g. started in
        // another tab) when this hook mounted.
        if (data.batchRunning) startPolling();
      }
    } catch (error) {
      console.error("Error fetching phash stats:", error);
    }
  }, [mountedRef, startPolling]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const computePhashes = useCallback(async () => {
    setIsComputing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/phash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start phash computation");
      }

      setMessage({ type: "success", text: "Computing perceptual hashes..." });
      startPolling();
    } catch (error) {
      setIsComputing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start phash computation",
      });
    }
  }, [setMessage, startPolling]);

  const resetAll = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/phash", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetAll: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset phashes");
      }

      setMessage({ type: "success", text: "All perceptual hashes cleared." });
      await fetchStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reset phashes",
      });
    }
  }, [setMessage, fetchStats]);

  return {
    phashStats,
    isComputing,
    fetchStats,
    computePhashes,
    resetAll,
  };
}
