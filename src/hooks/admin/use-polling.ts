"use client";

import { useEffect, useRef } from "react";

export interface UsePollingOptions {
  interval: number;
  enabled: boolean;
}

export function usePolling(callback: () => Promise<void>, options: UsePollingOptions): void {
  const { interval, enabled } = options;
  const callbackRef = useRef(callback);
  const mountedRef = useRef(true);
  const isPollingRef = useRef(false);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) return;

    const poll = async () => {
      // Prevent overlapping calls if previous poll is still running
      if (isPollingRef.current || !mountedRef.current) return;

      isPollingRef.current = true;
      try {
        await callbackRef.current();
      } catch (error) {
        console.error("Polling error:", error);
      } finally {
        isPollingRef.current = false;
      }
    };

    const intervalId = setInterval(poll, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [interval, enabled]);
}
