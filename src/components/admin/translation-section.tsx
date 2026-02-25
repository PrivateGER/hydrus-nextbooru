"use client";

import { CheckCircleIcon, ExclamationCircleIcon, LanguageIcon, StopIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { InfoBox } from "@/components/ui/info-box";
import { ModelSelect } from "./model-select";
import { POPULAR_MODELS, type ModelDefinition } from "@/lib/openrouter/types";
import type {
  TranslationSettings,
  TranslationEstimate,
  NoteTranslationEstimate,
  BulkTranslationProgress,
  ConfirmModalConfig,
} from "@/types/admin";

type ProviderTab = "openrouter" | "local";

export interface TranslationSectionProps {
  settings: TranslationSettings | null;
  estimate: TranslationEstimate | null;
  noteEstimate: NoteTranslationEstimate | null;
  bulkProgress: BulkTranslationProgress | null;
  noteBulkProgress: BulkTranslationProgress | null;

  // Form state
  provider: ProviderTab;
  targetLang: string;

  openrouterApiKey: string;
  openrouterModel: string;
  openrouterCustomModel: string;
  openrouterBaseUrl: string;

  localApiKey: string;
  localModel: string;
  localCustomModel: string;
  localBaseUrl: string;
  localModels: ModelDefinition[];
  isModelsLoading: boolean;

  // Form handlers
  onProviderChange: (value: ProviderTab) => void;
  onTargetLangChange: (value: string) => void;

  onOpenrouterApiKeyChange: (value: string) => void;
  onOpenrouterModelChange: (value: string) => void;
  onOpenrouterCustomModelChange: (value: string) => void;
  onOpenrouterBaseUrlChange: (value: string) => void;

  onLocalApiKeyChange: (value: string) => void;
  onLocalModelChange: (value: string) => void;
  onLocalCustomModelChange: (value: string) => void;
  onLocalBaseUrlChange: (value: string) => void;
  onRefreshModels: () => void;

  // Actions
  isSaving: boolean;
  isTranslating: boolean;
  isNoteTranslating: boolean;
  onSave: () => void;
  onStartBulk: () => void;
  onCancelBulk: () => void;
  onStartBulkNotes: () => void;
  onCancelBulkNotes: () => void;
  openConfirmModal: (config: Omit<ConfirmModalConfig, "isOpen">) => void;
}

export function TranslationSection({
  settings,
  estimate,
  noteEstimate,
  bulkProgress,
  noteBulkProgress,
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
  localModels,
  isModelsLoading,
  onProviderChange,
  onTargetLangChange,
  onOpenrouterApiKeyChange,
  onOpenrouterModelChange,
  onOpenrouterCustomModelChange,
  onOpenrouterBaseUrlChange,
  onLocalApiKeyChange,
  onLocalModelChange,
  onLocalCustomModelChange,
  onLocalBaseUrlChange,
  onRefreshModels,
  isSaving,
  isTranslating,
  isNoteTranslating,
  onSave,
  onStartBulk,
  onCancelBulk,
  onStartBulkNotes,
  onCancelBulkNotes,
  openConfirmModal,
}: TranslationSectionProps) {
  const isLocal = provider === "local";

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Translation Settings</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Choose OpenRouter or a local OpenAI-compatible endpoint to translate notes and images.{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Get OpenRouter key
          </a>
        </p>

        <div className="space-y-4">
          <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 p-1">
            <button
              type="button"
              onClick={() => onProviderChange("openrouter")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                !isLocal
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              OpenRouter
            </button>
            <button
              type="button"
              onClick={() => onProviderChange("local")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isLocal
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Local
            </button>
          </div>

          {!isLocal ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">OpenRouter Base URL</label>
                <Input
                  value={openrouterBaseUrl}
                  onChange={(e) => onOpenrouterBaseUrlChange(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">API Key</label>
                <Input
                  type="password"
                  value={openrouterApiKey}
                  onChange={(e) => onOpenrouterApiKeyChange(e.target.value)}
                  placeholder={settings?.openrouter.apiKeyConfigured ? "Enter new key..." : "sk-or-v1-..."}
                  hint={settings?.openrouter.apiKeyConfigured ? `Current: ${settings.openrouter.apiKey}` : undefined}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
                <ModelSelect
                  value={openrouterModel}
                  onChange={onOpenrouterModelChange}
                  models={POPULAR_MODELS}
                  allowCustom
                />
                {openrouterModel === "custom" && (
                  <div className="mt-2">
                    <Input
                      value={openrouterCustomModel}
                      onChange={(e) => onOpenrouterCustomModelChange(e.target.value)}
                      placeholder="model-provider/model-name"
                    />
                  </div>
                )}
                {openrouterModel !== "custom" && !POPULAR_MODELS.find((m) => m.id === openrouterModel)?.vision && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                    <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    This model only supports text translation (notes). Image text won&apos;t be translated.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Local Base URL</label>
                <Input
                  value={localBaseUrl}
                  onChange={(e) => onLocalBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:1234/api/v1"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">API Key (Optional)</label>
                <Input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => onLocalApiKeyChange(e.target.value)}
                  placeholder={settings?.local.apiKeyConfigured ? "Enter new key..." : "Optional"}
                  hint={settings?.local.apiKeyConfigured ? `Current: ${settings.local.apiKey}` : undefined}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
                <ModelSelect
                  value={localModel}
                  onChange={onLocalModelChange}
                  models={localModels}
                  allowCustom
                />
                {localModel === "custom" && (
                  <div className="mt-2">
                    <Input
                      value={localCustomModel}
                      onChange={(e) => onLocalCustomModelChange(e.target.value)}
                      placeholder="model-name"
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <span>{isModelsLoading ? "Loading models..." : `Loaded ${localModels.length} models`}</span>
                  <button
                    type="button"
                    onClick={onRefreshModels}
                    className="text-blue-400 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Target Language</label>
            <Select value={targetLang} onChange={(e) => onTargetLangChange(e.target.value)}>
              {(settings?.supportedLanguages ?? []).map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </Select>
          </div>

          <Button onClick={onSave} loading={isSaving}>
            <CheckCircleIconSolid className="h-4 w-4" />
            Save
          </Button>
        </div>
      </Card>

      {/* Bulk Title Translation */}
      {settings && estimate && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Bulk Title Translation</h3>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Translate all group titles at once
              </p>
            </div>
            {estimate.untranslatedCount === 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> All translated
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{estimate.totalUniqueTitles.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-emerald-400">{estimate.translatedCount.toLocaleString()}</p>
              <p className="text-xs text-emerald-400/60">Translated</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-amber-400">{estimate.untranslatedCount.toLocaleString()}</p>
              <p className="text-xs text-amber-400/60">Pending</p>
            </div>
          </div>

          {/* Cost Estimate */}
          {estimate.untranslatedCount > 0 && (
            <div className="mb-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-200/50 dark:bg-zinc-800/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Estimated cost</span>
                <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{estimate.estimatedCost}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>~{estimate.estimatedInputTokens.toLocaleString()} input + ~{estimate.estimatedOutputTokens.toLocaleString()} output tokens</span>
                <span>{estimate.model.split("/")[1]}</span>
              </div>
            </div>
          )}

          {/* Progress */}
          {bulkProgress?.status === "running" && (
            <div className="mb-4">
              <ProgressBar
                current={bulkProgress.completed + bulkProgress.failed}
                total={bulkProgress.total}
                color="purple"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{bulkProgress.completed} translated, {bulkProgress.failed} failed</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {bulkProgress?.status === "running" ? (
              <Button onClick={onCancelBulk} variant="danger">
                <StopIcon className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={() =>
                  openConfirmModal({
                    title: "Translate all titles?",
                    message: `This will translate ${estimate.untranslatedCount} titles for an estimated ${estimate.estimatedCost}.`,
                    confirmText: "Translate",
                    confirmVariant: "primary",
                    onConfirm: onStartBulk,
                  })
                }
                disabled={isTranslating || estimate.untranslatedCount === 0}
                loading={isTranslating}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <LanguageIcon className="h-4 w-4" />
                Translate {estimate.untranslatedCount.toLocaleString()} Titles
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Bulk Note Translation */}
      {settings && noteEstimate && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Bulk Note Translation</h3>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Translate all note content at once
              </p>
            </div>
            {noteEstimate.untranslatedCount === 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> All translated
              </span>
            )}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-300/50 dark:bg-zinc-700/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{noteEstimate.totalUniqueNotes.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-emerald-400">{noteEstimate.translatedCount.toLocaleString()}</p>
              <p className="text-xs text-emerald-400/60">Translated</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-amber-400">{noteEstimate.untranslatedCount.toLocaleString()}</p>
              <p className="text-xs text-amber-400/60">Pending</p>
            </div>
          </div>

          {noteEstimate.untranslatedCount > 0 && (
            <div className="mb-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-200/50 dark:bg-zinc-800/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Estimated cost</span>
                <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{noteEstimate.estimatedCost}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>~{noteEstimate.estimatedInputTokens.toLocaleString()} input + ~{noteEstimate.estimatedOutputTokens.toLocaleString()} output tokens</span>
                <span>{noteEstimate.model.split("/")[1]}</span>
              </div>
            </div>
          )}

          {noteBulkProgress?.status === "running" && (
            <div className="mb-4">
              <ProgressBar
                current={noteBulkProgress.completed + noteBulkProgress.failed}
                total={noteBulkProgress.total}
                color="purple"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{noteBulkProgress.completed} translated, {noteBulkProgress.failed} failed</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {noteBulkProgress?.status === "running" ? (
              <Button onClick={onCancelBulkNotes} variant="danger">
                <StopIcon className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={() =>
                  openConfirmModal({
                    title: "Translate all notes?",
                    message: `This will translate ${noteEstimate.untranslatedCount} unique notes for an estimated ${noteEstimate.estimatedCost}.`,
                    confirmText: "Translate",
                    confirmVariant: "primary",
                    onConfirm: onStartBulkNotes,
                  })
                }
                disabled={isNoteTranslating || noteEstimate.untranslatedCount === 0}
                loading={isNoteTranslating}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <LanguageIcon className="h-4 w-4" />
                Translate {noteEstimate.untranslatedCount.toLocaleString()} Notes
              </Button>
            )}
          </div>
        </Card>
      )}

      <InfoBox>Source language is auto-detected. Translations are saved and apply to all matching content.</InfoBox>
    </div>
  );
}
