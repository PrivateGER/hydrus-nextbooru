"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnails");
      const data = await response.json();
      if (mountedRef.current) {
        setThumbStats(data);
        setIsGenerating(data.batchRunning);
      }
    } catch (error) {
      console.error("Error fetching thumbnail stats:", error);
    }
  }, []);

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

      // Start polling for completion
      pollIntervalRef.current = setInterval(async () => {
        const statsResponse = await fetch("/api/admin/thumbnails");
        const statsData = await statsResponse.json();

        if (!mountedRef.current) return;

        setThumbStats(statsData);

        if (!statsData.batchRunning) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsGenerating(false);
          triggerSuccessAnimation();
          setMessage({
            type: "success",
            text: `Done! ${statsData.complete.toLocaleString()} thumbnails ready.`,
          });
        }
      }, 2000);
    } catch (error) {
      setIsGenerating(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start thumbnail generation",
      });
    }
  }, [setMessage, triggerSuccessAnimation]);

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
