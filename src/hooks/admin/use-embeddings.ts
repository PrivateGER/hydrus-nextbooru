"use client";

import { useState, useCallback, useEffect } from "react";
import { useBatchPolling } from "./use-batch-polling";
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION,
  DEFAULT_EMBEDDING_MODEL,
  POPULAR_EMBEDDING_MODELS,
} from "@/lib/openrouter/types";
import type { EmbeddingAdminStatus, Message } from "@/types/admin";

export interface UseEmbeddingsReturn {
  status: EmbeddingAdminStatus | null;
  isSaving: boolean;
  isComputing: boolean;
  apiKey: string;
  setApiKey: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  customModel: string;
  setCustomModel: (value: string) => void;
  dimensions: number;
  setDimensions: (value: number) => void;
  imageMaxResolution: number;
  setImageMaxResolution: (value: number) => void;
  fetchStatus: () => Promise<void>;
  saveSettings: () => Promise<void>;
  computeMissing: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearCurrent: () => Promise<void>;
  clearFailed: () => Promise<void>;
}

export function useEmbeddings(
  setMessage: (msg: Message | null) => void,
  triggerSuccessAnimation: () => void
): UseEmbeddingsReturn {
  const [status, setStatus] = useState<EmbeddingAdminStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isComputing, setIsComputing] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState(DEFAULT_EMBEDDING_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [dimensions, setDimensions] = useState(DEFAULT_EMBEDDING_DIMENSIONS);
  const [imageMaxResolution, setImageMaxResolution] = useState(DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION);

  const applyStatus = useCallback((data: EmbeddingAdminStatus) => {
    setStatus(data);
    setIsComputing(data.batchRunning);
    setBaseUrl(data.settings.baseUrl || "");
    setModel(data.settings.model);
    setDimensions(data.settings.dimensions);
    setImageMaxResolution(data.settings.imageMaxResolution);

    if (!POPULAR_EMBEDDING_MODELS.some((candidate) => candidate.id === data.settings.model)) {
      setCustomModel(data.settings.model);
      setModel("custom");
    } else {
      setCustomModel("");
    }
  }, []);

  const { mountedRef, startPolling } = useBatchPolling<EmbeddingAdminStatus>({
    url: "/api/admin/embeddings",
    onData: applyStatus,
    isActive: (data) => data.batchRunning,
    onStop: (data) => {
      setIsComputing(false);

      if (data.batchStatus === "completed") {
        triggerSuccessAnimation();
        setMessage({
          type: "success",
          text: `Done! ${data.stats.embedded.toLocaleString()} images embedded.`,
        });
      } else if (data.batchStatus === "failed") {
        setMessage({
          type: "error",
          text: data.batchError || "Embedding batch failed",
        });
      }
    },
    onPollError: () => {
      setIsComputing(false);
      setMessage({ type: "error", text: "Failed to check embedding status" });
    },
  });

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/embeddings");
      if (!response.ok) return;
      const data: EmbeddingAdminStatus = await response.json();
      if (mountedRef.current) {
        applyStatus(data);
        // Resume live updates if a batch was already running when this mounted.
        if (data.batchRunning) startPolling();
      }
    } catch (error) {
      console.error("Error fetching embedding status:", error);
    }
  }, [applyStatus, mountedRef, startPolling]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const effectiveModel = model === "custom" ? customModel.trim() : model;
      if (!effectiveModel) {
        throw new Error("Please enter an embedding model ID.");
      }

      const response = await fetch("/api/admin/embeddings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          baseUrl,
          model: effectiveModel,
          dimensions,
          imageMaxResolution,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save embedding settings");
      }

      triggerSuccessAnimation();
      setMessage({ type: "success", text: "Embedding settings saved!" });
      setApiKey("");
      await fetchStatus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save embedding settings",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    apiKey,
    baseUrl,
    model,
    customModel,
    dimensions,
    imageMaxResolution,
    setMessage,
    triggerSuccessAnimation,
    fetchStatus,
  ]);

  const startBatch = useCallback(async (retryFailed: boolean) => {
    setIsComputing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryFailed }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start embedding batch");
      }

      setMessage({ type: "success", text: retryFailed ? "Retrying failed embeddings..." : "Computing image embeddings..." });
      startPolling();
    } catch (error) {
      setIsComputing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start embedding batch",
      });
    }
  }, [setMessage, startPolling]);

  const deleteEmbeddings = useCallback(async (body: Record<string, boolean>, successMessage: string) => {
    try {
      const response = await fetch("/api/admin/embeddings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear embeddings");
      }

      setMessage({ type: "success", text: successMessage });
      await fetchStatus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to clear embeddings",
      });
    }
  }, [setMessage, fetchStatus]);

  const clearCurrent = useCallback(async () => {
    await deleteEmbeddings({ clearCurrent: true }, "Embeddings cleared.");
  }, [deleteEmbeddings]);

  const clearFailed = useCallback(async () => {
    await deleteEmbeddings({ clearFailed: true }, "Failed embeddings cleared.");
  }, [deleteEmbeddings]);

  return {
    status,
    isSaving,
    isComputing,
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    customModel,
    setCustomModel,
    dimensions,
    setDimensions,
    imageMaxResolution,
    setImageMaxResolution,
    fetchStatus,
    saveSettings,
    computeMissing: () => startBatch(false),
    retryFailed: () => startBatch(true),
    clearCurrent,
    clearFailed,
  };
}
