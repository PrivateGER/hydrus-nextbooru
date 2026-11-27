"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedSettings } from "@/lib/feed-settings";
import type { FeedSwipeStats } from "@/lib/swipes";
import type { Message } from "@/types/admin";

export interface FeedAdminStatus {
  settings: FeedSettings;
  defaults: FeedSettings;
  swipes: { allTime: FeedSwipeStats; recent: FeedSwipeStats; recentDays: number };
}

/** The combination measured to work best together on a large library. */
export const RECOMMENDED_FEED_SETTINGS: FeedSettings = {
  retrieval: "favorites",
  diversityLambda: 0.7,
  exploreShare: 0.1,
  quotaExponent: 0.5,
};

const NAMES: (keyof FeedSettings)[] = ["retrieval", "diversityLambda", "exploreShare", "quotaExponent"];

export interface UseFeedSettingsReturn {
  status: FeedAdminStatus | null;
  /** The values in the form; null until loaded. */
  draft: FeedSettings | null;
  setDraft: (change: Partial<FeedSettings>) => void;
  isDirty: boolean;
  isSaving: boolean;
  loadError: string | null;
  save: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFeedSettings(
  setMessage: (message: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseFeedSettingsReturn {
  const [status, setStatus] = useState<FeedAdminStatus | null>(null);
  const [draft, setDraftState] = useState<FeedSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return fetch("/api/admin/feed")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load feed settings");
        return data as FeedAdminStatus;
      })
      .then((data) => {
        setStatus(data);
        // Keep unsaved edits; only fill the form when it has none.
        setDraftState((current) => current ?? data.settings);
        setLoadError(null);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Failed to load feed settings");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setDraft = useCallback((change: Partial<FeedSettings>) => {
    setDraftState((current) => (current ? { ...current, ...change } : current));
  }, []);

  const isDirty = Boolean(status && draft && NAMES.some((name) => draft[name] !== status.settings[name]));

  const save = useCallback(async () => {
    if (!status || !draft) return;
    // Send only what changed; a value equal to the default clears the stored one.
    const body: Record<string, unknown> = {};
    for (const name of NAMES) {
      if (draft[name] !== status.settings[name]) {
        body[name] = draft[name] === status.defaults[name] ? null : draft[name];
      }
    }
    if (Object.keys(body).length === 0) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/feed", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save feed settings");
      setStatus((current) => (current ? { ...current, settings: data.settings } : current));
      setDraftState(data.settings);
      triggerSuccessAnimation();
      setMessage({ type: "success", text: "Feed settings saved. The feed is rebuilding." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save feed settings" });
    } finally {
      setIsSaving(false);
    }
  }, [status, draft, setMessage, triggerSuccessAnimation]);

  return { status, draft, setDraft, isDirty, isSaving, loadError, save, refresh };
}
