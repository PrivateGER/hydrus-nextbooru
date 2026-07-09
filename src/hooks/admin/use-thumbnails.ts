"use client";

import { useState, useCallback, useEffect } from "react";
import { useBatchPolling } from "./use-batch-polling";
import type { ThumbnailStats, Message } from "@/types/admin";

export interface UseThumbnailsReturn {
  thumbStats: ThumbnailStats | null;
  isGenerating: boolean;
  fetchStats: () => Promise<void>;
  generateThumbnails: () => Promise<void>;
  resetFailed: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useThumbnails(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseThumbnailsReturn {
  const [thumbStats, setThumbStats] = useState<ThumbnailStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { mountedRef, startPolling } = useBatchPolling<ThumbnailStats>({
    url: "/api/admin/thumbnails",
    onData: setThumbStats,
    isActive: (data) => data.batchRunning,
    onStop: (data) => {
      setIsGenerating(false);
      if (data.batchStatus === "failed") {
        setMessage({
          type: "error",
          text: data.batchError || "Thumbnail generation failed",
        });
        return;
      }
      triggerSuccessAnimation();
      setMessage({
        type: "success",
        text: `Done! ${data.complete.toLocaleString()} thumbnails ready.`,
      });
    },
    onPollError: () => {
      setIsGenerating(false);
      setMessage({
        type: "error",
        text: "Failed to check thumbnail generation status",
      });
    },
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnails");
      const data = await response.json();
      if (mountedRef.current) {
        setThumbStats(data);
        setIsGenerating(data.batchRunning);
        // Resume live updates if a batch was already running when this mounted.
        if (data.batchRunning) startPolling();
      }
    } catch (error) {
      console.error("Error fetching thumbnail stats:", error);
    }
  }, [mountedRef, startPolling]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const generateThumbnails = useCallback(async () => {
    setIsGenerating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start thumbnail generation");
      }

      setMessage({ type: "success", text: "Generating thumbnails..." });
      startPolling();
    } catch (error) {
      setIsGenerating(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start thumbnail generation",
      });
    }
  }, [setMessage, startPolling]);

  const resetFailed = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetFailed: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset thumbnails");
      }

      setMessage({ type: "success", text: "Failed thumbnails reset. Try generating again." });
      await fetchStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reset thumbnails",
      });
    }
  }, [setMessage, fetchStats]);

  const clearAll = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear thumbnails");
      }

      setMessage({ type: "success", text: "All thumbnails cleared." });
      await fetchStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to clear thumbnails",
      });
    }
  }, [setMessage, fetchStats]);

  return {
    thumbStats,
    isGenerating,
    fetchStats,
    generateThumbnails,
    resetFailed,
    clearAll,
  };
}
