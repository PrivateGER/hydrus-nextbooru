"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { HydrusTagServiceType } from "@/lib/hydrus/types";
import type { Message, SyncStatus, TagServicesStatus } from "@/types/admin";

export interface UseTagServicesReturn {
  status: TagServicesStatus | null;
  isLoading: boolean;
  isSaving: boolean;
  /** Draft: import every service ("All known tags"). */
  useAll: boolean;
  setUseAll: (value: boolean) => void;
  /** Draft: specific service keys (ignored while useAll is set). */
  selectedKeys: string[];
  toggleService: (serviceKey: string) => void;
  includePending: boolean;
  setIncludePending: (value: boolean) => void;
  fetchStatus: () => Promise<void>;
  /** Re-query Hydrus (e.g. after it was unreachable), showing a loading state. */
  retry: () => Promise<void>;
  saveSelection: () => Promise<void>;
}

export function useTagServices(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void,
  syncState: SyncStatus["status"] | undefined
): UseTagServicesReturn {
  const [status, setStatus] = useState<TagServicesStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [useAll, setUseAll] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [includePending, setIncludePending] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyStatus = useCallback((data: TagServicesStatus) => {
    setStatus(data);
    const keys = data.selection.serviceKeys ?? [];
    // A stored "all known tags" key (saved while Hydrus was down, so it could
    // not be normalized) means everything, same as the sync treats it.
    const allKnownKey = data.services?.find((s) => s.type === HydrusTagServiceType.AllKnownTags)?.serviceKey;
    const all = keys.length === 0 || (allKnownKey !== undefined && keys.includes(allKnownKey));
    setUseAll(all);
    setSelectedKeys(all ? [] : keys);
    setIncludePending(data.selection.includePending);
  }, []);

  // Promise-chain rather than async/await so the effects below satisfy
  // react-hooks/set-state-in-effect (state is only set in callbacks).
  const fetchStatus = useCallback(() => {
    return fetch("/api/admin/tag-services")
      .then((response) => (response.ok ? (response.json() as Promise<TagServicesStatus>) : null))
      .then((data) => {
        if (data && mountedRef.current) applyStatus(data);
      })
      .catch((error) => {
        console.error("Error fetching tag services:", error);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [applyStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // A finished full sync may have applied the selection: refresh pendingResync.
  const previousSyncState = useRef(syncState);
  useEffect(() => {
    const wasRunning = previousSyncState.current === "running";
    previousSyncState.current = syncState;
    if (wasRunning && syncState !== "running") {
      fetchStatus();
    }
  }, [syncState, fetchStatus]);

  const retry = useCallback(() => {
    setIsLoading(true);
    return fetchStatus();
  }, [fetchStatus]);

  const toggleService = useCallback((serviceKey: string) => {
    setSelectedKeys((keys) =>
      keys.includes(serviceKey) ? keys.filter((k) => k !== serviceKey) : [...keys, serviceKey]
    );
  }, []);

  const handleSetUseAll = useCallback((value: boolean) => {
    setUseAll(value);
    // "All known tags" is exclusive: it already includes every service.
    if (value) setSelectedKeys([]);
  }, []);

  const saveSelection = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/tag-services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceKeys: useAll ? null : selectedKeys,
          includePending,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save tag services");
      }

      triggerSuccessAnimation();
      setMessage({
        type: "success",
        text: data.pendingResync ? "Tag services saved. Run a full sync to apply." : "Tag services saved!",
      });
      await fetchStatus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save tag services",
      });
    } finally {
      setIsSaving(false);
    }
  }, [useAll, selectedKeys, includePending, setMessage, triggerSuccessAnimation, fetchStatus]);

  return {
    status,
    isLoading,
    isSaving,
    useAll,
    setUseAll: handleSetUseAll,
    selectedKeys,
    toggleService,
    includePending,
    setIncludePending,
    fetchStatus,
    retry,
    saveSelection,
  };
}
