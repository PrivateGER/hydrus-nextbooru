"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { POPULAR_MODELS, type ModelDefinition } from "@/lib/openrouter/types";
import type { TranslationSettings, TranslationEstimate, BulkTranslationProgress, Message } from "@/types/admin";

type ProviderTab = "openrouter" | "local";

export interface UseTranslationReturn {
  // Settings
  settings: TranslationSettings | null;
  estimate: TranslationEstimate | null;
  bulkProgress: BulkTranslationProgress | null;

  // Form state
  provider: ProviderTab;
  setProvider: (value: ProviderTab) => void;
  targetLang: string;
  setTargetLang: (value: string) => void;

  openrouterApiKey: string;
  setOpenrouterApiKey: (value: string) => void;
  openrouterModel: string;
  setOpenrouterModel: (value: string) => void;
  openrouterCustomModel: string;
  setOpenrouterCustomModel: (value: string) => void;
  openrouterBaseUrl: string;
  setOpenrouterBaseUrl: (value: string) => void;

  localApiKey: string;
  setLocalApiKey: (value: string) => void;
  localModel: string;
  setLocalModel: (value: string) => void;
  localCustomModel: string;
  setLocalCustomModel: (value: string) => void;
  localBaseUrl: string;
  setLocalBaseUrl: (value: string) => void;

  localModels: ModelDefinition[];
  isModelsLoading: boolean;

  // Loading states
  isSaving: boolean;
  isTranslating: boolean;

  // Actions
  fetchSettings: () => Promise<void>;
  fetchEstimate: () => Promise<void>;
  fetchBulkProgress: () => Promise<BulkTranslationProgress | null>;
  fetchModels: () => Promise<void>;
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
  const [provider, setProvider] = useState<ProviderTab>("openrouter");
  const [targetLang, setTargetLang] = useState("");

  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");
  const [openrouterCustomModel, setOpenrouterCustomModel] = useState("");
  const [openrouterBaseUrl, setOpenrouterBaseUrl] = useState("");

  const [localApiKey, setLocalApiKey] = useState("");
  const [localModel, setLocalModel] = useState("");
  const [localCustomModel, setLocalCustomModel] = useState("");
  const [localBaseUrl, setLocalBaseUrl] = useState("");

  const [localModels, setLocalModels] = useState<ModelDefinition[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);

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
      setProvider(data.provider);
      setTargetLang(data.targetLang);

      setOpenrouterBaseUrl(data.openrouter.baseUrl || "");
      setOpenrouterModel(data.openrouter.model);
      setLocalBaseUrl(data.local.baseUrl || "");
      setLocalModel(data.local.model || "");

      const isPopularModel = POPULAR_MODELS.some((m) => m.id === data.openrouter.model);
      if (!isPopularModel && data.openrouter.model) {
        setOpenrouterCustomModel(data.openrouter.model);
        setOpenrouterModel("custom");
      } else {
        setOpenrouterCustomModel("");
      }

      setLocalCustomModel("");
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

  const fetchModels = useCallback(async () => {
    if (!localBaseUrl.trim()) {
      setLocalModels([]);
      return;
    }

    setIsModelsLoading(true);
    try {
      const response = await fetch("/api/admin/models");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch models");
      }

      const models = Array.isArray(data.models)
        ? data.models.map((model: { id: string; name?: string }) => ({
            id: model.id,
            name: model.name || model.id,
          }))
        : [];

      if (mountedRef.current) {
        setLocalModels(models);
        if (localModel && localModel !== "custom" && !models.some((m) => m.id === localModel)) {
          setLocalCustomModel(localModel);
          setLocalModel("custom");
        }
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      if (mountedRef.current) {
        setLocalModels([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsModelsLoading(false);
      }
    }
  }, [localModel, localBaseUrl]);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
    fetchEstimate();
    fetchBulkProgress();
  }, [fetchSettings, fetchEstimate, fetchBulkProgress]);

  useEffect(() => {
    if (provider === "local") {
      fetchModels();
    }
  }, [provider, fetchModels]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const openrouterEffectiveModel =
        openrouterModel === "custom" ? openrouterCustomModel : openrouterModel;
      const localEffectiveModel = localModel === "custom" ? localCustomModel : localModel;

      if (provider === "openrouter" && openrouterModel === "custom" && !openrouterCustomModel.trim()) {
        throw new Error("Please enter a custom OpenRouter model ID.");
      }
      if (provider === "local" && localModel === "custom" && !localCustomModel.trim()) {
        throw new Error("Please enter a custom local model ID.");
      }

      const body: Record<string, unknown> = {
        provider,
        targetLang,
      };

      if (provider === "openrouter") {
        body.openrouter = {
          apiKey: openrouterApiKey,
          model: openrouterEffectiveModel,
          baseUrl: openrouterBaseUrl.trim(),
        };
      } else {
        body.local = {
          apiKey: localApiKey,
          model: localEffectiveModel,
          baseUrl: localBaseUrl.trim(),
        };
      }

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
      setOpenrouterApiKey("");
      setLocalApiKey("");
      await fetchSettings();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    provider,
    targetLang,
    openrouterApiKey,
    openrouterModel,
    openrouterCustomModel,
    openrouterBaseUrl,
    localApiKey,
    localModel,
    localCustomModel,
    localBaseUrl,
    setMessage,
    triggerSuccessAnimation,
    fetchSettings,
  ]);

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
    provider,
    setProvider,
    targetLang,
    setTargetLang,
    openrouterApiKey,
    setOpenrouterApiKey,
    openrouterModel,
    setOpenrouterModel,
    openrouterCustomModel,
    setOpenrouterCustomModel,
    openrouterBaseUrl,
    setOpenrouterBaseUrl,
    localApiKey,
    setLocalApiKey,
    localModel,
    setLocalModel,
    localCustomModel,
    setLocalCustomModel,
    localBaseUrl,
    setLocalBaseUrl,
    localModels,
    isModelsLoading,
    isSaving,
    isTranslating,
    fetchSettings,
    fetchEstimate,
    fetchBulkProgress,
    fetchModels,
    saveSettings,
    startBulkTranslation,
    cancelBulkTranslation,
  };
}
