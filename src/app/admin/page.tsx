"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloudArrowDownIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  EyeIcon,
  LanguageIcon,
  PhotoIcon,
  PlayIcon,
  QuestionMarkCircleIcon,
  StopIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { InfoBox } from "@/components/ui/info-box";
import { POPULAR_MODELS } from "@/lib/openrouter/types";
import {
  ArrowPathIcon as ArrowPathIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
} from "@heroicons/react/24/solid";

// Types
interface SyncStatus {
  status: "idle" | "running" | "completed" | "error" | "cancelled";
  lastSyncedAt: string | null;
  lastSyncCount: number;
  errorMessage: string | null;
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  totalBatches: number;
}

interface ThumbnailStats {
  total: number;
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  unsupported: number;
  batchRunning: boolean;
  batchProgress: { processed: number; total: number } | null;
}

interface TranslationSettings {
  apiKey: string | null;
  apiKeyConfigured: boolean;
  model: string;
  targetLang: string;
  supportedLanguages: { code: string; name: string }[];
  defaultModel: string;
}

type Section = "sync" | "thumbnails" | "translation" | "maintenance" | "help";

const NAV_ITEMS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: "sync", label: "Sync", icon: CloudArrowDownIcon, description: "Import files from Hydrus" },
  { id: "thumbnails", label: "Thumbnails", icon: PhotoIcon, description: "Generate preview images" },
  { id: "translation", label: "Translation", icon: LanguageIcon, description: "Configure AI translation" },
  { id: "maintenance", label: "Maintenance", icon: WrenchScrewdriverIcon, description: "Database utilities" },
  { id: "help", label: "Help", icon: QuestionMarkCircleIcon, description: "Documentation & tips" },
];

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  confirmVariant = "danger",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary";
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl duration-200">
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tooltip Component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setShow(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(false);
  };

  return (
    <div className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 shadow-lg">
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
          </div>
        </div>
      )}
    </div>
  );
}

// Success Animation Component
function SuccessCheck({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-in zoom-in-50 fade-in duration-300">
        <div className="rounded-full bg-emerald-500/20 p-6">
          <CheckCircleIconSolid className="h-16 w-16 text-emerald-400" />
        </div>
      </div>
    </div>
  );
}

// Model Select Component with inline icons
function ModelSelect({
  value,
  onChange,
  models,
  allowCustom = false,
}: {
  value: string;
  onChange: (value: string) => void;
  models: typeof POPULAR_MODELS;
  allowCustom?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === value);
  const isCustom = allowCustom && value === "custom";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const renderTags = (model: (typeof models)[0]) => (
    <span className="ml-auto flex items-center gap-1.5">
      {model.vision && (
        <span className="flex items-center gap-0.5 rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
          <EyeIcon className="h-3 w-3" />
          Vision
        </span>
      )}
      {model.expensive && (
        <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
          <BanknotesIcon className="h-3 w-3" />
          $$$
        </span>
      )}
    </span>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-sm outline-none transition-colors hover:border-zinc-600 focus:border-zinc-500"
      >
        <span className="flex items-center gap-2 overflow-hidden">
          {isCustom ? (
            <span className="text-zinc-400">Custom model</span>
          ) : selectedModel ? (
            <>
              <span className="truncate">{selectedModel.name}</span>
              {renderTags(selectedModel)}
            </>
          ) : (
            <span className="text-zinc-400">Select a model...</span>
          )}
        </span>
        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-64 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700/50 ${
                  value === m.id ? "bg-zinc-700/30 text-white" : "text-zinc-300"
                }`}
              >
                <span className="truncate">{m.name}</span>
                {renderTags(m)}
              </button>
            ))}
            {allowCustom && (
              <button
                type="button"
                onClick={() => {
                  onChange("custom");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 border-t border-zinc-700 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700/50 ${
                  isCustom ? "bg-zinc-700/30 text-white" : "text-zinc-400"
                }`}
              >
                Custom...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("sync");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [customTags, setCustomTags] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Thumbnail generation state
  const [thumbStats, setThumbStats] = useState<ThumbnailStats | null>(null);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);

  // Maintenance state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRegeneratingRecs, setIsRegeneratingRecs] = useState(false);

  // Translation settings state
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [targetLang, setTargetLang] = useState("");

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant: "danger" | "primary";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  // Polling interval refs for cleanup on unmount
  const syncPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const thumbPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      if (syncPollIntervalRef.current) {
        clearInterval(syncPollIntervalRef.current);
        syncPollIntervalRef.current = null;
      }
      if (thumbPollIntervalRef.current) {
        clearInterval(thumbPollIntervalRef.current);
        thumbPollIntervalRef.current = null;
      }
    };
  }, []);

  // Show success animation helper
  const triggerSuccessAnimation = () => {
    setShowSuccessAnimation(true);
    setTimeout(() => setShowSuccessAnimation(false), 1500);
  };

  // Handlers
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to logout",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const fetchThumbStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnails");
      const data = await response.json();
      setThumbStats(data);
      setIsGeneratingThumbs(data.batchRunning);
    } catch (error) {
      console.error("Error fetching thumbnail stats:", error);
    }
  }, []);

  const fetchTranslationSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const data: TranslationSettings = await response.json();
      setTranslationSettings(data);
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

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync");
      const data = await response.json();
      setSyncStatus(data);
      setIsSyncing(data.status === "running");
    } catch (error) {
      console.error("Error fetching sync status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchThumbStats();
    fetchTranslationSettings();

    const interval = setInterval(() => {
      if (isSyncing) {
        fetchStatus();
      }
      if (isGeneratingThumbs) {
        fetchThumbStats();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchThumbStats, fetchTranslationSettings, isSyncing, isGeneratingThumbs]);

  const startSync = async (tags?: string[]) => {
    setIsSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start sync");
      }

      setMessage({ type: "success", text: "Sync started! You can monitor progress below." });

      syncPollIntervalRef.current = setInterval(async () => {
        await fetchStatus();
        const statusResponse = await fetch("/api/admin/sync");
        const statusData = await statusResponse.json();

        if (statusData.status !== "running") {
          if (syncPollIntervalRef.current) {
            clearInterval(syncPollIntervalRef.current);
            syncPollIntervalRef.current = null;
          }
          setIsSyncing(false);

          if (statusData.status === "completed") {
            triggerSuccessAnimation();
            setMessage({
              type: "success",
              text: `Sync completed! ${statusData.lastSyncCount.toLocaleString()} files imported.`,
            });
          } else if (statusData.status === "cancelled") {
            setMessage({
              type: "success",
              text: `Sync cancelled. ${statusData.processedFiles.toLocaleString()} files were imported.`,
            });
          } else if (statusData.status === "error") {
            setMessage({
              type: "error",
              text: `Sync failed: ${statusData.errorMessage}`,
            });
          }
        }
      }, 2000);
    } catch (error) {
      setIsSyncing(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start sync",
      });
    }
  };

  const handleFullSync = () => startSync();

  const handleCustomSync = () => {
    const tags = customTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tags.length === 0) {
      setMessage({ type: "error", text: "Please enter at least one tag" });
      return;
    }

    startSync(tags);
  };

  const handleCancelSync = async () => {
    try {
      const response = await fetch("/api/admin/sync", { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel sync");
      }

      setMessage({ type: "success", text: "Stopping sync after current batch..." });
      await fetchStatus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel sync",
      });
    }
  };

  const handleGenerateThumbnails = async () => {
    setIsGeneratingThumbs(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start thumbnail generation");
      }

      setMessage({ type: "success", text: "Generating thumbnails..." });

      thumbPollIntervalRef.current = setInterval(async () => {
        await fetchThumbStats();
        const statsResponse = await fetch("/api/admin/thumbnails");
        const statsData = await statsResponse.json();

        if (!statsData.batchRunning) {
          if (thumbPollIntervalRef.current) {
            clearInterval(thumbPollIntervalRef.current);
            thumbPollIntervalRef.current = null;
          }
          setIsGeneratingThumbs(false);
          triggerSuccessAnimation();
          setMessage({
            type: "success",
            text: `Done! ${statsData.complete.toLocaleString()} thumbnails ready.`,
          });
        }
      }, 2000);
    } catch (error) {
      setIsGeneratingThumbs(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start thumbnail generation",
      });
    }
  };

  const handleResetFailedThumbnails = async () => {
    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetFailed: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset thumbnails");
      }

      setMessage({ type: "success", text: "Failed thumbnails reset. Try generating again." });
      await fetchThumbStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reset thumbnails",
      });
    }
  };

  const handleClearAllThumbnails = async () => {
    try {
      const response = await fetch("/api/admin/thumbnails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear thumbnails");
      }

      setMessage({ type: "success", text: "All thumbnails cleared." });
      await fetchThumbStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to clear thumbnails",
      });
    }
  };

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/stats", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to recalculate stats");
      }

      triggerSuccessAnimation();
      setMessage({ type: "success", text: "Statistics recalculated!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to recalculate stats",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRegenerateRecommendations = async () => {
    setIsRegeneratingRecs(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/recommendations", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start recommendation generation");
      }

      setMessage({ type: "success", text: "Generating recommendations in background..." });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch("/api/admin/recommendations");
        const statusData = await statusResponse.json();

        if (statusData.status !== "running") {
          clearInterval(pollInterval);
          setIsRegeneratingRecs(false);

          if (statusData.lastResult) {
            triggerSuccessAnimation();
            setMessage({
              type: "success",
              text: `Recommendations generated for ${statusData.lastResult.processed.toLocaleString()} posts!`,
            });
          }
        }
      }, 2000);
    } catch (error) {
      setIsRegeneratingRecs(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to generate recommendations",
      });
    }
  };

  const handleSaveTranslationSettings = async () => {
    setIsSavingSettings(true);
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
      await fetchTranslationSettings();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const openConfirmModal = (config: Omit<typeof confirmModal, "isOpen">) => {
    setConfirmModal({ ...config, isOpen: true });
  };

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ArrowPathIconSolid className="mx-auto h-8 w-8 animate-spin text-zinc-500" />
          <p className="mt-3 text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Reusable components
  const StatusBadge = ({ status }: { status: SyncStatus["status"] | undefined }) => {
    const config = {
      running: { bg: "bg-blue-500/10", text: "text-blue-400", icon: ArrowPathIcon, label: "Syncing" },
      completed: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircleIcon, label: "Complete" },
      error: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircleIcon, label: "Failed" },
      cancelled: { bg: "bg-amber-500/10", text: "text-amber-400", icon: ExclamationCircleIcon, label: "Cancelled" },
      idle: { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Cog6ToothIcon, label: "Ready" },
    };

    const { bg, text, icon: Icon, label } = config[status || "idle"];

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}>
        <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
        {label}
      </span>
    );
  };

  const ProgressBar = ({ current, total, color = "blue" }: { current: number; total: number; color?: "blue" | "purple" }) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const colorClass = color === "purple" ? "bg-purple-500" : "bg-blue-500";

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-300">{percentage}%</span>
          <span className="tabular-nums text-zinc-500">
            {current.toLocaleString()} / {total.toLocaleString()}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const Button = ({
    onClick,
    disabled,
    variant = "primary",
    loading,
    children,
    className = "",
    tooltip,
  }: {
    onClick: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary" | "danger";
    loading?: boolean;
    children: React.ReactNode;
    className?: string;
    tooltip?: string;
  }) => {
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-500",
      secondary: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
      danger: "bg-red-600 text-white hover:bg-red-500",
    };

    const button = (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      >
        {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
  };

  const Input = ({
    type = "text",
    value,
    onChange,
    placeholder,
    disabled,
    className = "",
    hint,
  }: {
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    hint?: string;
  }) => (
    <div className="space-y-1">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500 disabled:opacity-50 ${className}`}
      />
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );

  const Select = ({ value, onChange, children }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) => (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500"
    >
      {children}
    </select>
  );

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-800/50 p-5 ${className}`}>{children}</div>
  );

  // Section components
  const SyncSection = () => (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${syncStatus?.status === "running" ? "bg-blue-500/10" : "bg-zinc-700"}`}>
              <CloudArrowDownIcon className={`h-5 w-5 ${syncStatus?.status === "running" ? "text-blue-400" : "text-zinc-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={syncStatus?.status} />
                {syncStatus?.lastSyncedAt && (
                  <span className="text-xs text-zinc-500">{formatDate(syncStatus.lastSyncedAt)}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-zinc-400">
                {syncStatus?.lastSyncCount ? `${syncStatus.lastSyncCount.toLocaleString()} files synced` : "No syncs yet"}
              </p>
            </div>
          </div>
          {syncStatus?.status !== "running" && (
            <Button onClick={handleFullSync} disabled={isSyncing} tooltip="Import all files from Hydrus">
              <PlayIcon className="h-4 w-4" />
              Start Sync
            </Button>
          )}
        </div>

        {syncStatus?.status === "running" && syncStatus.totalFiles > 0 && (
          <div className="mt-4 space-y-3 border-t border-zinc-700 pt-4">
            <ProgressBar current={syncStatus.processedFiles} total={syncStatus.totalFiles} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Batch {syncStatus.currentBatch} of {syncStatus.totalBatches}
              </span>
              <Button onClick={handleCancelSync} variant="danger" tooltip="Stop after current batch">
                <StopIcon className="h-4 w-4" />
                Stop
              </Button>
            </div>
          </div>
        )}

        {syncStatus?.errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            <XCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p>{syncStatus.errorMessage}</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Sync by Tags</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              placeholder="character:samus, creator:artist"
              disabled={isSyncing}
              hint="Separate tags with commas"
            />
          </div>
          <Button onClick={handleCustomSync} disabled={isSyncing || !customTags.trim()} variant="secondary" className="sm:self-start">
            Sync
          </Button>
        </div>
      </Card>

      <InfoBox variant="note">
        Syncing imports metadata only. Files stay in Hydrus and are served directly from there.
      </InfoBox>
    </div>
  );

  const ThumbnailsSection = () => {
    const allComplete = thumbStats && thumbStats.pending === 0 && thumbStats.failed === 0;
    const hasIssues = (thumbStats?.failed ?? 0) > 0 || (thumbStats?.unsupported ?? 0) > 0;

    return (
      <div className="space-y-5">
        {thumbStats && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-zinc-200">Overview</h3>
              {allComplete && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircleIcon className="h-4 w-4" /> All ready
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-zinc-700/50 p-3 text-center">
                <p className="text-xl font-bold tabular-nums">{thumbStats.total.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-amber-400">{thumbStats.pending.toLocaleString()}</p>
                <p className="text-xs text-amber-400/60">Pending</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-emerald-400">{thumbStats.complete.toLocaleString()}</p>
                <p className="text-xs text-emerald-400/60">Complete</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-red-400">{thumbStats.failed.toLocaleString()}</p>
                <p className="text-xs text-red-400/60">Failed</p>
              </div>
              <div className="rounded-lg bg-zinc-700/50 p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-zinc-400">{thumbStats.unsupported.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Unsupported</p>
              </div>
            </div>

            {thumbStats.batchRunning && thumbStats.batchProgress && (
              <div className="mt-4 border-t border-zinc-700 pt-4">
                <ProgressBar current={thumbStats.batchProgress.processed} total={thumbStats.batchProgress.total} color="purple" />
              </div>
            )}
          </Card>
        )}

        <Card>
          <h3 className="mb-3 font-medium text-zinc-200">Generate Thumbnails</h3>
          <p className="mb-4 text-sm text-zinc-400">
            Pre-generate thumbnails for faster browsing. They&apos;re also created on-demand.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerateThumbnails}
              disabled={isGeneratingThumbs || (thumbStats?.pending ?? 0) === 0}
              loading={isGeneratingThumbs}
              className="bg-purple-600 hover:bg-purple-500"
            >
              <PhotoIcon className="h-4 w-4" />
              Generate {thumbStats?.pending?.toLocaleString() ?? 0}
            </Button>
            {hasIssues && (
              <Button onClick={handleResetFailedThumbnails} disabled={isGeneratingThumbs} variant="secondary">
                <ArrowPathIcon className="h-4 w-4" />
                Retry Failed
              </Button>
            )}
          </div>
        </Card>

        {(thumbStats?.complete ?? 0) > 0 && (
          <Card className="border-red-500/20">
            <h3 className="mb-2 font-medium text-red-400">Danger Zone</h3>
            <p className="mb-3 text-sm text-zinc-400">Delete all thumbnails. They&apos;ll need to be regenerated.</p>
            <Button
              onClick={() =>
                openConfirmModal({
                  title: "Delete all thumbnails?",
                  message: `This will remove ${thumbStats?.complete.toLocaleString()} thumbnails.`,
                  confirmText: "Delete All",
                  confirmVariant: "danger",
                  onConfirm: handleClearAllThumbnails,
                })
              }
              disabled={isGeneratingThumbs}
              variant="danger"
            >
              <TrashIcon className="h-4 w-4" />
              Clear All
            </Button>
          </Card>
        )}
      </div>
    );
  };

  const TranslationSection = () => (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-200">Translation Settings</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Use a model from OpenRouter to translate notes and images.{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Get API key
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={translationSettings?.apiKeyConfigured ? "Enter new key..." : "sk-or-v1-..."}
              hint={translationSettings?.apiKeyConfigured ? `Current: ${translationSettings.apiKey}` : undefined}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Model</label>
            <ModelSelect
              value={model}
              onChange={setModel}
              models={POPULAR_MODELS}
              allowCustom
            />
            {model === "custom" && (
              <div className="mt-2">
                <Input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="model-provider/model-name"
                />
              </div>
            )}
            {model !== "custom" && !POPULAR_MODELS.find((m) => m.id === model)?.vision && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                This model only supports text translation (notes). Image text won&apos;t be translated.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Target Language</label>
            <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              {translationSettings?.supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </Select>
          </div>

          <Button onClick={handleSaveTranslationSettings} loading={isSavingSettings}>
            <CheckCircleIconSolid className="h-4 w-4" />
            Save
          </Button>
        </div>
      </Card>

      <InfoBox>Source language is auto-detected. Translations are saved and apply to all matching content.</InfoBox>
    </div>
  );

  const MaintenanceSection = () => (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-200">Recalculate Statistics</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Update tag counts and homepage stats. Runs automatically after sync.
        </p>
        <Button onClick={handleRecalculateStats} disabled={isRecalculating || isSyncing} loading={isRecalculating} variant="secondary">
          <ArrowPathIcon className="h-4 w-4" />
          Recalculate
        </Button>

        <InfoBox variant="tip" className={"mt-2"}>Run this if tag counts or homepage stats look incorrect.</InfoBox>
      </Card>

      <Card>
        <h3 className="mb-1 font-medium text-zinc-200">Regenerate Recommendations</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Rebuild &quot;Similar Posts&quot; suggestions based on tag similarity. Runs automatically after sync.
        </p>
        <Button onClick={handleRegenerateRecommendations} disabled={isRegeneratingRecs || isSyncing} loading={isRegeneratingRecs} variant="secondary">
          <ArrowPathIcon className="h-4 w-4" />
          Regenerate
        </Button>

        <InfoBox variant="tip" className={"mt-2"}>Run this if similar posts aren&apos;t showing or seem outdated.</InfoBox>
      </Card>
    </div>
  );

  const HelpSection = () => (
    <div className="space-y-5">
      {/* Quick Start */}
      <Card>
        <h3 className="mb-4 font-medium text-zinc-200">Quick Start</h3>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: "Configure Hydrus",
              desc: "In Hydrus, go to Services → Manage Services → Client API. Enable it and create an access key with file and tag permissions.",
            },
            {
              step: 2,
              title: "Set environment variables",
              desc: "Add HYDRUS_API_URL, HYDRUS_API_KEY, and HYDRUS_FILES_PATH to your .env file.",
            },
            {
              step: 3,
              title: "Run your first sync",
              desc: "Click Start Sync to import metadata. Only file info is stored — actual files stay in Hydrus.",
            },
            {
              step: 4,
              title: "Generate thumbnails",
              desc: "Pre-generate thumbnails for faster browsing, or let them create automatically as you browse.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
                {step}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{title}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Environment Variables */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Environment Variables</h3>

        <p className="mb-2 text-xs font-medium text-zinc-400">Required</p>
        <div className="mb-4 space-y-2 text-sm">
          {[
            { name: "DATABASE_URL", desc: "PostgreSQL connection string" },
            { name: "ADMIN_PASSWORD", desc: "Password for admin login" },
            { name: "HYDRUS_API_URL", desc: "Hydrus Client API endpoint (default port: 45869)" },
            { name: "HYDRUS_API_KEY", desc: "Access key from Hydrus Client API settings" },
            { name: "HYDRUS_FILES_PATH", desc: "Path to Hydrus client_files directory" },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-lg bg-zinc-700/30 p-2.5">
              <code className="shrink-0 text-xs font-medium text-blue-400">{name}</code>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs font-medium text-zinc-400">Optional</p>
        <div className="space-y-2 text-sm">
          {[
            { name: "LOG_QUERIES", desc: "Log SQL queries with timing (true/false)" },
            { name: "LOG_LEVEL", desc: "Logging verbosity (debug, info, warn, error)" },
            { name: "TAG_BLACKLIST", desc: "Comma-separated tags to hide from display" },
            { name: "OPENROUTER_API_KEY", desc: "API key for translation (can also set in UI)" },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-lg bg-zinc-700/30 p-2.5">
              <code className="shrink-0 text-xs font-medium text-zinc-400">{name}</code>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tag Syntax */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Tag Syntax</h3>
        <p className="mb-3 text-xs text-zinc-400">
          Use Hydrus tag format when filtering syncs. Tags are case-insensitive.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { tag: "creator:artist name", desc: "Creator/artist namespace" },
            { tag: "system:inbox", desc: "Files in inbox" },
            { tag: "system:archive", desc: "Archived files" },
            { tag: "system:limit=1000", desc: "Limit to 1000 files" },
            { tag: "system:filetype=image/*", desc: "Filter by file type" },
          ].map(({ tag, desc }) => (
            <div key={tag} className="flex items-start gap-2 rounded bg-zinc-700/30 p-2">
              <code className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{tag}</code>
              <span className="text-xs text-zinc-500">{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Troubleshooting</h3>
        <div className="space-y-4">
          {[
            {
              q: "Sync fails with connection error",
              a: "Make sure Hydrus is running and the Client API is enabled. Check that HYDRUS_API_URL is correct and the port matches.",
            },
            {
              q: "Images not loading",
              a: "Verify HYDRUS_FILES_PATH points to your Hydrus client_files directory. The path must be accessible from the server at all times!",
            },
            {
              q: "Thumbnails failing to generate",
              a: "Some file types (like PSD or rare formats) may not be supported. Check the Thumbnails tab for failed/unsupported counts.",
            },
            {
              q: "Tag counts seem wrong",
              a: "Run Recalculate Statistics in the Maintenance tab to rebuild all tag counts and homepage stats.",
            },
            {
              q: "Sync is slow",
              a: "Large libraries take time. Sync processes files in batches. Interrupting a partial sync will not interfere with operation, it can simply be restarted later. You can use tag filters to sync specific subsets.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-medium text-zinc-300">{q}</p>
              <p className="mt-1 text-xs text-zinc-500">{a}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tips */}
      <InfoBox variant="note" title="Need more help?">
        Check the project README for detailed setup instructions, or open an issue on GitHub if you encounter problems.
      </InfoBox>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "sync": return <SyncSection />;
      case "thumbnails": return <ThumbnailsSection />;
      case "translation": return <TranslationSection />;
      case "maintenance": return <MaintenanceSection />;
      case "help": return <HelpSection />;
    }
  };

  return (
    <>
      <SuccessCheck show={showSuccessAnimation} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            {isLoggingOut ? "..." : "Sign Out"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-800/50 p-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-blue-400" : ""}`} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Message Toast */}
        {message && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 animate-in slide-in-from-top-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
            )}
            <p className="flex-1 text-sm">{message.text}</p>
            <button onClick={() => setMessage(null)} className="rounded p-1 hover:bg-white/10">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {renderSection()}
      </div>
    </>
  );
}
