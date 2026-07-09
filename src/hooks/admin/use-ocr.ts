"use client";

import { useState, useCallback, useEffect } from "react";
import { useBatchPolling } from "./use-batch-polling";
import type { OcrStats, Message } from "@/types/admin";

export interface UseOcrReturn {
  ocrStats: OcrStats | null;
  isRunning: boolean;
  fetchStats: () => Promise<void>;
  startBatch: (options: { limit?: number; tags?: string[]; retryFailed?: boolean }) => Promise<void>;
  cancelBatch: () => Promise<void>;
  forceReset: () => Promise<void>;
}

export function useOcr(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseOcrReturn {
  const [ocrStats, setOcrStats] = useState<OcrStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const isBatchActive = (data: OcrStats) =>
    data.batch.status === "running" || data.batch.status === "cancelling";

  // Poll loop started from user actions only; refreshes stats every 2s and
  // self-stops once the batch is no longer active.
  const { mountedRef, startPolling } = useBatchPolling<OcrStats>({
    url: "/api/admin/ocr",
    onData: (data) => {
      setOcrStats(data);
      setIsRunning(isBatchActive(data));
    },
    isActive: isBatchActive,
    onPollError: () => setIsRunning(false),
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ocr");
      if (!response.ok) return;
      const data = (await response.json()) as OcrStats;
      if (!mountedRef.current) return;
      const active = data.batch.status === "running" || data.batch.status === "cancelling";
      setOcrStats(data);
      setIsRunning(active);
      // If a batch is already active when this mounts (e.g. started in another
      // tab), start polling so updatedAt keeps refreshing and the stalled gate
      // isn't tripped by an aging one-shot fetch.
      if (active) startPolling();
    } catch (error) {
      console.error("Error fetching OCR stats:", error);
    }
  }, [startPolling, mountedRef]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const startBatch = useCallback(
    async (options: { limit?: number; tags?: string[]; retryFailed?: boolean }) => {
      setMessage(null);
      setIsRunning(true);
      try {
        const response = await fetch("/api/admin/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to start OCR batch");
        }
        setMessage({ type: "success", text: "OCR batch started" });
        triggerSuccessAnimation();
        startPolling();
        await fetchStats();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to start OCR batch",
        });
        // A 409 means a batch is already running; reconcile state and resume
        // live updates. A hard rejection (400/503) simply self-stops on the
        // next poll tick once fetchStats reports no active batch.
        startPolling();
        await fetchStats();
      }
    },
    [setMessage, triggerSuccessAnimation, startPolling, fetchStats]
  );

  const cancelBatch = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ocr", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to cancel OCR batch");
      }
      startPolling();
      await fetchStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel OCR batch",
      });
    }
  }, [startPolling, fetchStats, setMessage]);

  const forceReset = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ocr?force=1", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset OCR batch");
      }
      setMessage({
        type: "success",
        text: data.cancelled ? "OCR batch reset" : "No stuck batch to reset",
      });
      startPolling();
      await fetchStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reset OCR batch",
      });
    }
  }, [startPolling, fetchStats, setMessage]);

  return { ocrStats, isRunning, fetchStats, startBatch, cancelBatch, forceReset };
}
