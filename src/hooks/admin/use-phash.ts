"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

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
      const response = await fetch("/api/admin/phash");
      if (!response.ok) return;
      const data = await response.json();
      if (mountedRef.current) {
        setPhashStats(data);
        setIsComputing(data.batchRunning);
      }
    } catch (error) {
      console.error("Error fetching phash stats:", error);
    }
  }, []);

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

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statsResponse = await fetch("/api/admin/phash");
          if (!statsResponse.ok) return;
          const statsData = await statsResponse.json();

          if (!mountedRef.current) return;

          setPhashStats(statsData);

          if (!statsData.batchRunning) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsComputing(false);
            triggerSuccessAnimation();
            setMessage({
              type: "success",
              text: `Done! ${statsData.withPhash.toLocaleString()} images hashed.`,
            });
          }
        } catch (error) {
          console.error("Error polling phash status:", error);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (mountedRef.current) {
            setIsComputing(false);
            setMessage({
              type: "error",
              text: "Failed to check phash computation status",
            });
          }
        }
      }, 2000);
    } catch (error) {
      setIsComputing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start phash computation",
      });
    }
  }, [setMessage, triggerSuccessAnimation]);

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
