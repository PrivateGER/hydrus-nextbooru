"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { POPULAR_MODELS, type ModelDefinition } from "@/lib/openrouter/types";
import type {
  TranslationSettings,
  TranslationEstimate,
  NoteTranslationEstimate,
  BulkTranslationProgress,
  Message,
} from "@/types/admin";

type ProviderTab = "openrouter" | "local";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseProvider(value: unknown): ProviderTab {
  return value === "local" ? "local" : "openrouter";
}

function parseString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function resolveApiKeyUpdate(apiKey: string, isConfigured: boolean): string | undefined {
  const trimmedKey = apiKey.trim();

  if (!trimmedKey && isConfigured) {
    return undefined;
  }

  return trimmedKey;
}

function parseTranslationSettingsPayload(value: unknown): TranslationSettings | null {
  if (!isRecord(value)) return null;

  const openrouter = value.openrouter;
  const local = value.local;

  if (!isRecord(openrouter) || !isRecord(local)) {
    return null;
  }

  const supportedLanguages = Array.isArray(value.supportedLanguages)
    ? value.supportedLanguages
        .filter((language): language is { code: string; name: string } => (
          isRecord(language)
          && typeof language.code === "string"
          && typeof language.name === "string"
        ))
    : [{ code: "en", name: "English" }];

  const defaultModel = parseString(value.defaultModel, POPULAR_MODELS[0]?.id || "");

  return {
    provider: parseProvider(value.provider),
    targetLang: parseString(value.targetLang, "en"),
    supportedLanguages,
    defaultModel,
    openrouter: {
      apiKey: typeof openrouter.apiKey === "string" || openrouter.apiKey === null
        ? openrouter.apiKey
        : null,
      apiKeyConfigured: Boolean(openrouter.apiKeyConfigured),
      model: parseString(openrouter.model, defaultModel),
      baseUrl: typeof openrouter.baseUrl === "string" || openrouter.baseUrl === null
        ? openrouter.baseUrl
        : null,
    },
    local: {
      apiKey: typeof local.apiKey === "string" || local.apiKey === null
        ? local.apiKey
        : null,
      apiKeyConfigured: Boolean(local.apiKeyConfigured),
      model: parseString(local.model),
      baseUrl: typeof local.baseUrl === "string" || local.baseUrl === null
        ? local.baseUrl
        : null,
    },
  };
}

function isBulkTranslationProgressPayload(value: unknown): value is BulkTranslationProgress {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<BulkTranslationProgress> & Record<string, unknown>;

  return (
    typeof candidate.status === "string" &&
    typeof candidate.total === "number" &&
    typeof candidate.completed === "number" &&
    typeof candidate.failed === "number" &&
    Array.isArray(candidate.errors)
  );
}

export interface UseTranslationReturn {
  // Settings
  settings: TranslationSettings | null;
  estimate: TranslationEstimate | null;
  noteEstimate: NoteTranslationEstimate | null;
  bulkProgress: BulkTranslationProgress | null;
  noteBulkProgress: BulkTranslationProgress | null;

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
  isNoteTranslating: boolean;

  // Actions
  fetchSettings: () => Promise<void>;
  fetchEstimate: () => Promise<void>;
  fetchNoteEstimate: () => Promise<void>;
  fetchBulkProgress: () => Promise<BulkTranslationProgress | null>;
  fetchNoteBulkProgress: () => Promise<BulkTranslationProgress | null>;
  fetchModels: () => Promise<void>;
  saveSettings: () => Promise<void>;
  startBulkTranslation: () => Promise<void>;
  cancelBulkTranslation: () => Promise<void>;
  startBulkNoteTranslation: () => Promise<void>;
  cancelBulkNoteTranslation: () => Promise<void>;
}

export function useTranslation(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseTranslationReturn {
  // Settings state
  const [settings, setSettings] = useState<TranslationSettings | null>(null);
  const [estimate, setEstimate] = useState<TranslationEstimate | null>(null);
  const [noteEstimate, setNoteEstimate] = useState<NoteTranslationEstimate | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkTranslationProgress | null>(null);
  const [noteBulkProgress, setNoteBulkProgress] = useState<BulkTranslationProgress | null>(null);

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
  const [isNoteTranslating, setIsNoteTranslating] = useState(false);

  const titlePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (titlePollIntervalRef.current) {
        clearInterval(titlePollIntervalRef.current);
        titlePollIntervalRef.current = null;
      }
      if (notePollIntervalRef.current) {
        clearInterval(notePollIntervalRef.current);
        notePollIntervalRef.current = null;
      }
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const rawData: unknown = await response.json();

      if (!response.ok) {
        const error =
          rawData && typeof rawData === "object" && "error" in rawData
            ? (rawData as { error?: unknown }).error
            : rawData;
        throw new Error(typeof error === "string" ? error : "Failed to fetch translation settings");
      }

      const data = parseTranslationSettingsPayload(rawData);
      if (!data) {
        throw new Error("Invalid translation settings payload");
      }

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

  const fetchNoteEstimate = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/note-translations/estimate");
      if (response.ok) {
        const data: NoteTranslationEstimate = await response.json();
        if (mountedRef.current) {
          setNoteEstimate(data);
        }
      }
    } catch (error) {
      console.error("Error fetching note translation estimate:", error);
    }
  }, []);

  const fetchBulkProgress = useCallback(async (): Promise<BulkTranslationProgress | null> => {
    try {
      const response = await fetch("/api/admin/translations");
      const data: unknown = await response.json();

      if (!response.ok) {
        const error =
          data && typeof data === "object" && "error" in data
            ? (data as { error?: unknown }).error
            : data;
        console.error("Error fetching bulk translation progress:", error);
        return null;
      }

      if (data && typeof data === "object" && "error" in data) {
        console.error(
          "Error fetching bulk translation progress:",
          (data as { error?: unknown }).error
        );
        return null;
      }

      if (!isBulkTranslationProgressPayload(data)) {
        console.error("Invalid bulk translation progress payload:", data);
        return null;
      }

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

  const fetchNoteBulkProgress = useCallback(async (): Promise<BulkTranslationProgress | null> => {
    try {
      const response = await fetch("/api/admin/note-translations");
      const data: unknown = await response.json();

      if (!response.ok) {
        const error =
          data && typeof data === "object" && "error" in data
            ? (data as { error?: unknown }).error
            : data;
        console.error("Error fetching note translation progress:", error);
        return null;
      }

      if (data && typeof data === "object" && "error" in data) {
        console.error(
          "Error fetching note translation progress:",
          (data as { error?: unknown }).error
        );
        return null;
      }

      if (!isBulkTranslationProgressPayload(data)) {
        console.error("Invalid note translation progress payload:", data);
        return null;
      }

      if (mountedRef.current) {
        setNoteBulkProgress(data);
        setIsNoteTranslating(data.status === "running");
      }
      return data;
    } catch (error) {
      console.error("Error fetching note translation progress:", error);
      return null;
    }
  }, []);

  const fetchModels = useCallback(async () => {
    setIsModelsLoading(true);
    try {
      const response = await fetch("/api/admin/models");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch models");
      }

      const models: ModelDefinition[] = Array.isArray(data.models)
        ? data.models.map((model: { id: string; name?: string }): ModelDefinition => ({
            id: model.id,
            name: model.name || model.id,
          }))
        : [];

      if (mountedRef.current) {
        setLocalModels(models);
        setLocalModel((prev) => {
          if (prev && prev !== "custom" && !models.some((m) => m.id === prev)) {
            setLocalCustomModel(prev);
            return "custom";
          }
          return prev;
        });
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
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
    fetchEstimate();
    fetchNoteEstimate();
    fetchBulkProgress();
    fetchNoteBulkProgress();
  }, [fetchSettings, fetchEstimate, fetchNoteEstimate, fetchBulkProgress, fetchNoteBulkProgress]);

  useEffect(() => {
    if (provider !== "local") return;

    void fetchModels();
  }, [provider, fetchModels]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const trimmedOpenrouterCustomModel = openrouterCustomModel.trim();
      const trimmedLocalCustomModel = localCustomModel.trim();
      const openrouterEffectiveModel =
        openrouterModel === "custom" ? trimmedOpenrouterCustomModel : openrouterModel;
      const localEffectiveModel = localModel === "custom" ? trimmedLocalCustomModel : localModel;

      if (provider === "openrouter" && openrouterModel === "custom" && !trimmedOpenrouterCustomModel) {
        throw new Error("Please enter a custom OpenRouter model ID.");
      }
      if (provider === "local" && localModel === "custom" && !trimmedLocalCustomModel) {
        throw new Error("Please enter a custom local model ID.");
      }

      const body: Record<string, unknown> = {
        provider,
        targetLang,
      };

      if (provider === "openrouter") {
        const openrouterApiKeyUpdate = resolveApiKeyUpdate(
          openrouterApiKey,
          settings?.openrouter.apiKeyConfigured ?? false
        );

        body.openrouter = {
          apiKey: openrouterApiKeyUpdate,
          model: openrouterEffectiveModel,
          baseUrl: openrouterBaseUrl.trim(),
        };
      } else {
        const localApiKeyUpdate = resolveApiKeyUpdate(
          localApiKey,
          settings?.local.apiKeyConfigured ?? false
        );

        body.local = {
          apiKey: localApiKeyUpdate,
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
      if (provider === "local") {
        await fetchModels();
      }
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
    settings,
    setMessage,
    triggerSuccessAnimation,
    fetchSettings,
    fetchModels,
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
      titlePollIntervalRef.current = setInterval(async () => {
        const progress = await fetchBulkProgress();

        if (!mountedRef.current) return;

        if (progress && progress.status !== "running") {
          if (titlePollIntervalRef.current) {
            clearInterval(titlePollIntervalRef.current);
            titlePollIntervalRef.current = null;
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

  const startBulkNoteTranslation = useCallback(async () => {
    setIsNoteTranslating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/note-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start note translation");
      }

      setMessage({ type: "success", text: "Translating notes..." });

      notePollIntervalRef.current = setInterval(async () => {
        const progress = await fetchNoteBulkProgress();

        if (!mountedRef.current) return;

        if (progress && progress.status !== "running") {
          if (notePollIntervalRef.current) {
            clearInterval(notePollIntervalRef.current);
            notePollIntervalRef.current = null;
          }
          setIsNoteTranslating(false);
          await fetchNoteEstimate();

          if (progress.status === "completed") {
            triggerSuccessAnimation();
            setMessage({
              type: "success",
              text: `Done! ${progress.completed} notes translated${progress.failed > 0 ? `, ${progress.failed} failed` : ""}.`,
            });
          } else if (progress.status === "cancelled") {
            setMessage({
              type: "success",
              text: `Cancelled. ${progress.completed} notes were translated.`,
            });
          } else if (progress.status === "error") {
            setMessage({
              type: "error",
              text: `Note translation failed: ${progress.errors[0] || "Unknown error"}`,
            });
          }
        }
      }, 1000);
    } catch (error) {
      setIsNoteTranslating(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start note translation",
      });
    }
  }, [targetLang, setMessage, triggerSuccessAnimation, fetchNoteBulkProgress, fetchNoteEstimate]);

  const cancelBulkNoteTranslation = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/note-translations", { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel note translation");
      }

      setMessage({ type: "success", text: "Stopping note translation..." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel note translation",
      });
    }
  }, [setMessage]);

  return {
    settings,
    estimate,
    noteEstimate,
    bulkProgress,
    noteBulkProgress,
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
    isNoteTranslating,
    fetchSettings,
    fetchEstimate,
    fetchNoteEstimate,
    fetchBulkProgress,
    fetchNoteBulkProgress,
    fetchModels,
    saveSettings,
    startBulkTranslation,
    cancelBulkTranslation,
    startBulkNoteTranslation,
    cancelBulkNoteTranslation,
  };
}
