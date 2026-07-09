"use client";

import { useCallback, useEffect, useRef } from "react";

interface BatchPollingOptions<T> {
  /** Status endpoint polled while a batch is active. */
  url: string;
  /** Applied to every successful poll response (while mounted). */
  onData: (data: T) => void;
  /** Return true while the batch is still running; false stops the poll loop. */
  isActive: (data: T) => boolean;
  /** Called once with the final response after polling stops normally. */
  onStop?: (data: T) => void;
  /** Called if a poll request throws (polling has already stopped). */
  onPollError?: () => void;
  intervalMs?: number;
}

/**
 * Shared poll loop for the admin batch hooks (sync, thumbnails, phash,
 * embeddings, OCR): an imperative interval started from user actions that
 * refreshes stats until the batch reports inactive, plus the mounted-guard
 * used by the hooks' own fetch functions.
 *
 * `startPolling` is idempotent and stable; the latest callbacks are always
 * used via a ref, so callers can pass inline closures.
 */
export function useBatchPolling<T>(options: BatchPollingOptions<T>) {
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(pollIntervalRef.current ?? undefined);
      pollIntervalRef.current = null;
    };
  }, []);

  const stopPolling = useCallback(() => {
    clearInterval(pollIntervalRef.current ?? undefined);
    pollIntervalRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(async () => {
      const o = optionsRef.current;
      try {
        const response = await fetch(o.url);
        if (!response.ok) return;
        const data: T = await response.json();
        if (!mountedRef.current) return;

        o.onData(data);
        if (!o.isActive(data)) {
          stopPolling();
          o.onStop?.(data);
        }
      } catch (error) {
        console.error(`Error polling ${o.url}:`, error);
        stopPolling();
        if (mountedRef.current) {
          o.onPollError?.();
        }
      }
    }, optionsRef.current.intervalMs ?? 2000);
  }, [stopPolling]);

  return { mountedRef, startPolling, stopPolling };
}
