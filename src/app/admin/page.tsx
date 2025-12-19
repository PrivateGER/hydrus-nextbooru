"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";

interface SyncStatus {
  status: "idle" | "running" | "completed" | "error" | "cancelled";
  lastSyncedAt: string | null;
  lastSyncCount: number;
  errorMessage: string | null;
  // Progress data
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

const POPULAR_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini Flash 2.5" },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek v3.2" },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1" },
];

/**
 * Admin dashboard for managing library synchronization, thumbnail generation, and translation settings.
 *
 * Renders UI for viewing sync status and progress, starting/canceling full or tag-based syncs, generating or clearing thumbnails, and configuring translation API/model/target language.
 *
 * @returns The React JSX element for the admin sync page
 */
export default function AdminPage() {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [customTags, setCustomTags] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Thumbnail generation state
  const [thumbStats, setThumbStats] = useState<ThumbnailStats | null>(null);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);

  // Maintenance state
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Translation settings state
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [targetLang, setTargetLang] = useState("");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push("/");
    router.refresh();
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

      // Check if model is in the popular list or custom
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

    // Poll for status while syncing or generating thumbnails
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

      setMessage({ type: "success", text: "Sync started! This may take a while..." });

      // Start polling for status
      const pollInterval = setInterval(async () => {
        await fetchStatus();
        const statusResponse = await fetch("/api/admin/sync");
        const statusData = await statusResponse.json();

        if (statusData.status !== "running") {
          clearInterval(pollInterval);
          setIsSyncing(false);

          if (statusData.status === "completed") {
            setMessage({
              type: "success",
              text: `Sync completed! ${statusData.lastSyncCount} files synced.`,
            });
          } else if (statusData.status === "cancelled") {
            setMessage({
              type: "success",
              text: `Sync cancelled. ${statusData.processedFiles} files were synced before cancellation.`,
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

  const handleFullSync = () => {
    startSync();
  };

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
      const response = await fetch("/api/admin/sync", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel sync");
      }

      setMessage({ type: "success", text: "Cancellation requested. Sync will stop after current batch." });
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

      setMessage({ type: "success", text: "Thumbnail generation started!" });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        await fetchThumbStats();
        const statsResponse = await fetch("/api/admin/thumbnails");
        const statsData = await statsResponse.json();

        if (!statsData.batchRunning) {
          clearInterval(pollInterval);
          setIsGeneratingThumbs(false);
          setMessage({
            type: "success",
            text: `Thumbnail generation complete! ${statsData.complete} thumbnails ready.`,
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

      setMessage({ type: "success", text: data.message });
      await fetchThumbStats();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reset thumbnails",
      });
    }
  };

  const handleClearAllThumbnails = async () => {
    if (!confirm("Are you sure you want to delete all generated thumbnails? This will remove all thumbnail files and reset all posts to pending.")) {
      return;
    }

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

      setMessage({ type: "success", text: data.message });
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
      const response = await fetch("/api/admin/stats", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to recalculate stats");
      }

      setMessage({ type: "success", text: data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to recalculate stats",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveTranslationSettings = async () => {
    setIsSavingSettings(true);
    setMessage(null);

    try {
      const effectiveModel = model === "custom" ? customModel : model;

      const body: Record<string, string> = {};
      if (apiKey) {
        body.apiKey = apiKey;
      }
      if (effectiveModel) {
        body.model = effectiveModel;
      }
      if (targetLang) {
        body.targetLang = targetLang;
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

      setMessage({ type: "success", text: "Translation settings saved!" });
      setApiKey(""); // Clear API key field after save
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
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      {/* Status card */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-4 text-lg font-semibold">Sync Status</h2>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-400">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  syncStatus?.status === "running"
                    ? "bg-blue-500/20 text-blue-400"
                    : syncStatus?.status === "completed"
                      ? "bg-green-500/20 text-green-400"
                      : syncStatus?.status === "error"
                        ? "bg-red-500/20 text-red-400"
                        : syncStatus?.status === "cancelled"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {syncStatus?.status === "running" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                )}
                {syncStatus?.status || "idle"}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-zinc-400">Last Sync</dt>
            <dd className="mt-1">{formatDate(syncStatus?.lastSyncedAt ?? null)}</dd>
          </div>

          <div>
            <dt className="text-zinc-400">Files Synced</dt>
            <dd className="mt-1">{syncStatus?.lastSyncCount?.toLocaleString() || 0}</dd>
          </div>

          {/* Progress bar when syncing */}
          {syncStatus?.status === "running" && syncStatus.totalFiles > 0 && (
            <div className="col-span-2 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Progress</span>
                <span className="text-zinc-300">
                  {syncStatus.processedFiles.toLocaleString()} / {syncStatus.totalFiles.toLocaleString()} files
                  {syncStatus.totalBatches > 0 && (
                    <span className="ml-2 text-zinc-500">
                      (Batch {syncStatus.currentBatch}/{syncStatus.totalBatches})
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((syncStatus.processedFiles / syncStatus.totalFiles) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-right text-sm text-zinc-400">
                {Math.round((syncStatus.processedFiles / syncStatus.totalFiles) * 100)}%
              </div>
            </div>
          )}

          {syncStatus?.errorMessage && (
            <div className="col-span-2">
              <dt className="text-zinc-400">Error</dt>
              <dd className="mt-1 text-red-400">{syncStatus.errorMessage}</dd>
            </div>
          )}
        </dl>

        {/* Cancel button for running syncs */}
        {syncStatus?.status === "running" && (
          <div className="mt-4 border-t border-zinc-700 pt-4">
            <button
              onClick={handleCancelSync}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Cancel Sync
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Full sync */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-2 text-lg font-semibold">Full Sync</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Sync all files from Hydrus. This may take a while for large libraries.<br />This does not copy file content. For already existing files, only metadata will be updated.
        </p>
        <button
          onClick={handleFullSync}
          disabled={isSyncing}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSyncing ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Syncing...
            </span>
          ) : (
            "Start Full Sync"
          )}
        </button>
      </div>

      {/* Custom sync */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-2 text-lg font-semibold">Custom Sync</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Sync files matching specific tags. Separate multiple tags with commas.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTags}
            onChange={(e) => setCustomTags(e.target.value)}
            placeholder="e.g., character:samus, creator:artist_name"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={isSyncing}
          />
          <button
            onClick={handleCustomSync}
            disabled={isSyncing || !customTags.trim()}
            className="rounded-lg bg-zinc-700 px-4 py-2 font-medium transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sync
          </button>
        </div>
      </div>

      {/* Thumbnail Generation */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-4 text-lg font-semibold">Thumbnail Generation</h2>

        {/* Stats grid */}
        {thumbStats && (
          <dl className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-zinc-400">Total Posts</dt>
              <dd className="mt-1 text-xl font-semibold">{thumbStats.total.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Pending</dt>
              <dd className="mt-1 text-xl font-semibold text-yellow-400">
                {thumbStats.pending.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Complete</dt>
              <dd className="mt-1 text-xl font-semibold text-green-400">
                {thumbStats.complete.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Failed</dt>
              <dd className="mt-1 text-xl font-semibold text-red-400">
                {thumbStats.failed.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Unsupported</dt>
              <dd className="mt-1 text-xl font-semibold text-zinc-500">
                {thumbStats.unsupported.toLocaleString()}
              </dd>
            </div>
          </dl>
        )}

        {/* Progress bar when generating */}
        {thumbStats?.batchRunning && thumbStats.batchProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Generating...</span>
              <span className="text-zinc-300">
                {thumbStats.batchProgress.processed.toLocaleString()} /{" "}
                {thumbStats.batchProgress.total.toLocaleString()} posts
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-700">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-300"
                style={{
                  width: `${
                    thumbStats.batchProgress.total > 0
                      ? Math.round(
                          (thumbStats.batchProgress.processed / thumbStats.batchProgress.total) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-right text-sm text-zinc-400">
              {thumbStats.batchProgress.total > 0
                ? Math.round(
                    (thumbStats.batchProgress.processed / thumbStats.batchProgress.total) * 100
                  )
                : 0}
              %
            </div>
          </div>
        )}

        <p className="mb-4 text-sm text-zinc-400">
          Generate high-quality WebP thumbnails for all posts. Thumbnails are generated on-demand
          when browsing, but you can pre-generate them here.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateThumbnails}
            disabled={isGeneratingThumbs || (thumbStats?.pending ?? 0) === 0}
            className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGeneratingThumbs ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </span>
            ) : (
              `Generate ${thumbStats?.pending?.toLocaleString() ?? 0} Missing Thumbnails`
            )}
          </button>

          {((thumbStats?.failed ?? 0) > 0 || (thumbStats?.unsupported ?? 0) > 0) && (
            <button
              onClick={handleResetFailedThumbnails}
              disabled={isGeneratingThumbs}
              className="rounded-lg bg-zinc-700 px-4 py-2 font-medium transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset {((thumbStats?.failed ?? 0) + (thumbStats?.unsupported ?? 0)).toLocaleString()} Failed/Unsupported
            </button>
          )}

          {(thumbStats?.complete ?? 0) > 0 && (
            <button
              onClick={handleClearAllThumbnails}
              disabled={isGeneratingThumbs}
              className="rounded-lg bg-red-600/80 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear All Thumbnails
            </button>
          )}
        </div>
      </div>

      {/* Maintenance */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-2 text-lg font-semibold">Maintenance</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Recalculate tag counts and homepage statistics. This is done automatically after sync,
          but can be triggered manually if needed.
        </p>
        <button
          onClick={handleRecalculateStats}
          disabled={isRecalculating || isSyncing}
          className="rounded-lg bg-zinc-700 px-4 py-2 font-medium transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRecalculating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Recalculating...
            </span>
          ) : (
            "Recalculate All Stats"
          )}
        </button>
      </div>

      {/* Translation Settings */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-4 text-lg font-semibold">Translation Settings</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Configure OpenRouter API for note translation. Get your API key from{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            openrouter.ai/keys
          </a>
        </p>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label htmlFor="apiKey" className="mb-1 block text-sm font-medium">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={translationSettings?.apiKeyConfigured ? "••••••••••••" : "sk-or-..."}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {translationSettings?.apiKeyConfigured && (
              <p className="mt-1 text-xs text-zinc-500">
                Current: {translationSettings.apiKey}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label htmlFor="model" className="mb-1 block text-sm font-medium">
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {POPULAR_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="custom">Custom Model...</option>
            </select>
            {model === "custom" && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g., meta-llama/llama-3.1-70b-instruct"
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Target Language */}
          <div>
            <label htmlFor="targetLang" className="mb-1 block text-sm font-medium">
              Target Language
            </label>
            <select
              id="targetLang"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {translationSettings?.supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Source language is auto-detected
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveTranslationSettings}
            disabled={isSavingSettings}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingSettings ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="rounded-lg bg-zinc-800 p-6">
        <h2 className="mb-2 text-lg font-semibold">Help</h2>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>
            <strong>Before syncing:</strong> Make sure Hydrus is running and the Client API is
            enabled with the correct API key in your .env file.
          </p>
          <p>
            <strong>Tag format:</strong> Use Hydrus tag format like{" "}
            <code className="rounded bg-zinc-900 px-1">character:samus aran</code> or{" "}
            <code className="rounded bg-zinc-900 px-1">system:inbox</code>.
          </p>
          <p>
            <strong>System tags:</strong> You can use system predicates like{" "}
            <code className="rounded bg-zinc-900 px-1">system:limit=100</code> to limit results.
          </p>
        </div>
      </div>
    </div>
  );
}
