"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { POPULAR_MODELS } from "@/lib/openrouter/types";
import type { TranslationSettings, TranslationEstimate, BulkTranslationProgress, Message } from "@/types/admin";

export interface UseTranslationReturn {
  // Settings
  settings: TranslationSettings | null;
  estimate: TranslationEstimate | null;
  bulkProgress: BulkTranslationProgress | null;

  // Form state
  apiKey: string;
  setApiKey: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  customModel: string;
  setCustomModel: (value: string) => void;
  targetLang: string;
  setTargetLang: (value: string) => void;

  // Loading states
  isSaving: boolean;
  isTranslating: boolean;

  // Actions
  fetchSettings: () => Promise<void>;
  fetchEstimate: () => Promise<void>;
  fetchBulkProgress: () => Promise<BulkTranslationProgress | null>;
  saveSettings: () => Promise<void>;
  startBulkTranslation: () => Promise<void>;
  cancelBulkTranslation: () => Promise<void>;
}

export function useTranslation(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseTranslationReturn {
  // Settings state
  const [settings, setSettings] = useState<TranslationSettings | null>(null);
  const [estimate, setEstimate] = useState<TranslationEstimate | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkTranslationProgress | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [targetLang, setTargetLang] = useState("");

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

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

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const data: TranslationSettings = await response.json();

      if (!mountedRef.current) return;

      setSettings(data);
      setModel(data.model);
      setTargetLang(data.targetLang);

      const isPopularModel = POPULAR_MODELS.some((m) => m.id === data.model);
      if (!isPopularModel && data.model) {
        setCustomModel(data.model);
        setModel("custom");
      }
    } catch (error) {
      console.error("Error fetching translation settings:", error);
    }
  }, []);

  const fetchEstimate = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/translations/estimate");
      if (response.ok) {
        const data: TranslationEstimate = await response.json();
        if (mountedRef.current) {
          setEstimate(data);
        }
      }
    } catch (error) {
      console.error("Error fetching translation estimate:", error);
    }
  }, []);

  const fetchBulkProgress = useCallback(async (): Promise<BulkTranslationProgress | null> => {
    try {
      const response = await fetch("/api/admin/translations");
      const data: BulkTranslationProgress = await response.json();

      if (mountedRef.current) {
        setBulkProgress(data);
        setIsTranslating(data.status === "running");
      }
      return data;
    } catch (error) {
      console.error("Error fetching bulk translation progress:", error);
      return null;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
    fetchEstimate();
    fetchBulkProgress();
  }, [fetchSettings, fetchEstimate, fetchBulkProgress]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const effectiveModel = model === "custom" ? customModel : model;

      const body: Record<string, string> = {};
      if (apiKey) body.apiKey = apiKey;
      if (effectiveModel) body.model = effectiveModel;
      if (targetLang) body.targetLang = targetLang;

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      triggerSuccessAnimation();
      setMessage({ type: "success", text: "Settings saved!" });
      setApiKey("");
      await fetchSettings();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, model, customModel, targetLang, setMessage, triggerSuccessAnimation, fetchSettings]);

  const startBulkTranslation = useCallback(async () => {
    setIsTranslating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start translation");
      }

      setMessage({ type: "success", text: "Translating titles..." });

      // Start polling for progress
      pollIntervalRef.current = setInterval(async () => {
        const progress = await fetchBulkProgress();

        if (!mountedRef.current) return;

        if (progress && progress.status !== "running") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsTranslating(false);
          await fetchEstimate();

          if (progress.status === "completed") {
            triggerSuccessAnimation();
            setMessage({
              type: "success",
              text: `Done! ${progress.completed} titles translated${progress.failed > 0 ? `, ${progress.failed} failed` : ""}.`,
            });
          } else if (progress.status === "cancelled") {
            setMessage({
              type: "success",
              text: `Cancelled. ${progress.completed} titles were translated.`,
            });
          } else if (progress.status === "error") {
            setMessage({
              type: "error",
              text: `Translation failed: ${progress.errors[0] || "Unknown error"}`,
            });
          }
        }
      }, 1000);
    } catch (error) {
      setIsTranslating(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start translation",
      });
    }
  }, [targetLang, setMessage, triggerSuccessAnimation, fetchBulkProgress, fetchEstimate]);

  const cancelBulkTranslation = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/translations", { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel translation");
      }

      setMessage({ type: "success", text: "Stopping translation..." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel translation",
      });
    }
  }, [setMessage]);

  return {
    settings,
    estimate,
    bulkProgress,
    apiKey,
    setApiKey,
    model,
    setModel,
    customModel,
    setCustomModel,
    targetLang,
    setTargetLang,
    isSaving,
    isTranslating,
    fetchSettings,
    fetchEstimate,
    fetchBulkProgress,
    saveSettings,
    startBulkTranslation,
    cancelBulkTranslation,
  };
}
