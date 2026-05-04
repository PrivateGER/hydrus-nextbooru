"use client";

import {
  CheckCircleIcon,
  CircleStackIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { InfoBox } from "@/components/ui/info-box";
import { ModelSelect } from "@/components/admin/model-select";
import {
  EMBEDDING_DIMENSION_OPTIONS,
  EMBEDDING_RESOLUTION_OPTIONS,
  POPULAR_EMBEDDING_MODELS,
} from "@/lib/openrouter/types";
import type { ConfirmModalConfig } from "@/types/admin";
import type { UseEmbeddingsReturn } from "@/hooks/admin/use-embeddings";

export interface EmbeddingsSectionProps {
  embeddings: UseEmbeddingsReturn;
  openConfirmModal: (config: Omit<ConfirmModalConfig, "isOpen">) => void;
}

export function EmbeddingsSection({
  embeddings,
  openConfirmModal,
}: EmbeddingsSectionProps) {
  const {
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
    saveSettings,
    computeMissing,
    retryFailed,
    clearCurrent,
    clearFailed,
  } = embeddings;

  const stats = status?.stats;
  const settings = status?.settings;
  const extensionsReady = Boolean(stats?.extensions.vector && stats?.extensions.vchord);
  const allEmbedded = stats && stats.pending === 0 && stats.failed === 0;

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Embedding Settings</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Configure OpenRouter multimodal embeddings for semantic image search.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">OpenRouter Base URL</label>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings?.apiKeyConfigured ? "Enter new key..." : "sk-or-v1-..."}
              hint={settings?.apiKeyConfigured ? `Current: ${settings.apiKey}` : undefined}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Embedding Model</label>
            <ModelSelect
              value={model}
              onChange={setModel}
              models={POPULAR_EMBEDDING_MODELS}
              allowCustom
            />
            {model === "custom" && (
              <div className="mt-2">
                <Input
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder="provider/model-name"
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Dimensions</label>
              <Select value={String(dimensions)} onChange={(event) => setDimensions(Number(event.target.value))}>
                {EMBEDDING_DIMENSION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Image Resolution</label>
              <Select value={String(imageMaxResolution)} onChange={(event) => setImageMaxResolution(Number(event.target.value))}>
                {EMBEDDING_RESOLUTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}px longest side</option>
                ))}
              </Select>
            </div>
          </div>

          <Button onClick={saveSettings} loading={isSaving}>
            <CheckCircleIconSolid className="h-4 w-4" />
            Save
          </Button>
        </div>
      </Card>

      {stats && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Overview</h3>
            {allEmbedded && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> All embedded
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Supported" value={stats.supported} />
            <Stat label="Embedded" value={stats.embedded} tone="emerald" />
            <Stat label="Pending" value={stats.pending} tone="amber" />
            <Stat label="Failed" value={stats.failed} tone="red" />
            <Stat label="Unsupported" value={stats.unsupported} />
          </div>

          <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Model: {settings?.model}</span>
              <span>Dimensions: {settings?.dimensions}</span>
              <span>Resolution: {settings?.imageMaxResolution}px</span>
              <span>vector: {stats.extensions.vector || "missing"}</span>
              <span>vchord: {stats.extensions.vchord || "missing"}</span>
            </div>
          </div>

          {status.batchRunning && status.batchProgress && (
            <div className="mt-4 border-t border-zinc-300 pt-4 dark:border-zinc-700">
              <ProgressBar current={status.batchProgress.processed} total={status.batchProgress.total} color="purple" />
            </div>
          )}

          {!extensionsReady && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
              <ExclamationCircleIcon className="h-4 w-4" />
              VectorChord extensions are missing from the database.
            </p>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">Compute Embeddings</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Generate image embeddings for semantic text-to-image search.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={computeMissing}
            disabled={isComputing || status?.batchRunning || !extensionsReady || !settings?.apiKeyConfigured || (stats?.pending ?? 0) === 0}
            loading={isComputing || status?.batchRunning}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <SparklesIcon className="h-4 w-4" />
            Embed {stats?.pending.toLocaleString() ?? 0}
          </Button>

          <Button
            onClick={retryFailed}
            disabled={isComputing || status?.batchRunning || !extensionsReady || !settings?.apiKeyConfigured || (stats?.failed ?? 0) === 0}
            variant="secondary"
          >
            <CircleStackIcon className="h-4 w-4" />
            Retry {stats?.failed.toLocaleString() ?? 0}
          </Button>
        </div>

        {!settings?.apiKeyConfigured && (
          <InfoBox variant="tip" className="mt-3">
            Save an OpenRouter API key before generating embeddings.
          </InfoBox>
        )}
      </Card>

      {((stats?.embedded ?? 0) > 0 || (stats?.failed ?? 0) > 0) && (
        <Card className="border-red-500/20">
          <h3 className="mb-2 font-medium text-red-500 dark:text-red-400">Danger Zone</h3>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Clear embeddings for the current model, dimension, and resolution.
          </p>
          <div className="flex flex-wrap gap-2">
            {(stats?.failed ?? 0) > 0 && (
              <Button
                onClick={() =>
                  openConfirmModal({
                    title: "Clear failed embeddings?",
                    message: `This will remove ${stats?.failed.toLocaleString()} failed embedding records for the active configuration.`,
                    confirmText: "Clear Failed",
                    confirmVariant: "danger",
                    onConfirm: clearFailed,
                  })
                }
                disabled={isComputing}
                variant="danger"
              >
                <TrashIcon className="h-4 w-4" />
                Clear Failed
              </Button>
            )}
            {(stats?.embedded ?? 0) > 0 && (
              <Button
                onClick={() =>
                  openConfirmModal({
                    title: "Delete embeddings?",
                    message: `This will remove ${stats?.embedded.toLocaleString()} embeddings for the active configuration.`,
                    confirmText: "Delete",
                    confirmVariant: "danger",
                    onConfirm: clearCurrent,
                  })
                }
                disabled={isComputing}
                variant="danger"
              >
                <TrashIcon className="h-4 w-4" />
                Clear Current
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "emerald" | "amber" | "red";
}) {
  const toneClass = {
    zinc: "bg-zinc-300/50 dark:bg-zinc-700/50 text-zinc-800 dark:text-zinc-200",
    emerald: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-500 dark:text-amber-400",
    red: "bg-red-500/10 text-red-500 dark:text-red-400",
  }[tone];

  return (
    <div className={`rounded-lg p-3 text-center ${toneClass}`}>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}
