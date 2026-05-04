// Admin page types

export interface SyncStatus {
  status: "idle" | "running" | "completed" | "error" | "cancelled";
  lastSyncedAt: string | null;
  lastSyncCount: number;
  errorMessage: string | null;
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  totalBatches: number;
}

export interface ThumbnailStats {
  total: number;
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  unsupported: number;
  batchRunning: boolean;
  batchProgress: { processed: number; total: number } | null;
}

export interface TranslationSettings {
  provider: "openrouter" | "local";
  targetLang: string;
  supportedLanguages: { code: string; name: string }[];
  defaultModel: string;
  openrouter: {
    apiKey: string | null;
    apiKeyConfigured: boolean;
    model: string;
    baseUrl: string | null;
  };
  local: {
    apiKey: string | null;
    apiKeyConfigured: boolean;
    model: string;
    baseUrl: string | null;
  };
}

export interface TranslationEstimate {
  totalUniqueTitles: number;
  translatedCount: number;
  untranslatedCount: number;
  uniqueTitlesToTranslate: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: string;
  estimatedCostUsd: number;
  model: string;
  pricing: { inputPer1M: number; outputPer1M: number };
}

export interface NoteTranslationEstimate {
  totalUniqueNotes: number;
  translatedCount: number;
  untranslatedCount: number;
  uniqueNotesToTranslate: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: string;
  estimatedCostUsd: number;
  model: string;
  pricing: { inputPer1M: number; outputPer1M: number };
}

export interface BulkTranslationProgress {
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface PhashStats {
  total: number;
  withPhash: number;
  withoutPhash: number;
  unsupported: number;
  batchRunning: boolean;
  batchProgress: { processed: number; total: number } | null;
  batchStatus: "idle" | "running" | "completed" | "failed";
  batchError: string | null;
}

export interface EmbeddingSettings {
  apiKey: string | null;
  apiKeyConfigured: boolean;
  baseUrl: string | null;
  model: string;
  dimensions: number;
  imageMaxResolution: number;
}

export interface EmbeddingStats {
  total: number;
  supported: number;
  embedded: number;
  pending: number;
  failed: number;
  unsupported: number;
  extensions: {
    vector: string | null;
    vchord: string | null;
  };
}

export interface EmbeddingBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export interface EmbeddingAdminStatus {
  settings: EmbeddingSettings;
  stats: EmbeddingStats;
  batchRunning: boolean;
  batchProgress: { processed: number; total: number } | null;
  batchStatus: "idle" | "running" | "completed" | "failed";
  batchError: string | null;
  lastBatchResult: EmbeddingBatchResult | null;
}

export type Section = "sync" | "thumbnails" | "translation" | "phash" | "embeddings" | "maintenance" | "help";

export interface Message {
  type: "success" | "error";
  text: string;
}

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant: "danger" | "primary";
  onConfirm: () => void;
}

export interface NavItem {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}
