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
  apiKey: string | null;
  apiKeyConfigured: boolean;
  model: string;
  targetLang: string;
  supportedLanguages: { code: string; name: string }[];
  defaultModel: string;
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

export interface BulkTranslationProgress {
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

export type Section = "sync" | "thumbnails" | "translation" | "maintenance" | "help";

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
