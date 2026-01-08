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
import { POPULAR_MODELS } from "@/lib/openrouter/types";
import type { TranslationSettings, TranslationEstimate, BulkTranslationProgress, ConfirmModalConfig } from "@/types/admin";

export interface TranslationSectionProps {
  settings: TranslationSettings | null;
  estimate: TranslationEstimate | null;
  bulkProgress: BulkTranslationProgress | null;

  // Form state
  apiKey: string;
  model: string;
  customModel: string;
  targetLang: string;

  // Form handlers
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onCustomModelChange: (value: string) => void;
  onTargetLangChange: (value: string) => void;

  // Actions
  isSaving: boolean;
  isTranslating: boolean;
  onSave: () => void;
  onStartBulk: () => void;
  onCancelBulk: () => void;
  openConfirmModal: (config: Omit<ConfirmModalConfig, "isOpen">) => void;
}

export function TranslationSection({
  settings,
  estimate,
  bulkProgress,
  apiKey,
  model,
  customModel,
  targetLang,
  onApiKeyChange,
  onModelChange,
  onCustomModelChange,
  onTargetLangChange,
  isSaving,
  isTranslating,
  onSave,
  onStartBulk,
  onCancelBulk,
  openConfirmModal,
}: TranslationSectionProps) {
  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Translation Settings</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Use a model from OpenRouter to translate notes and images.{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Get API key
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={settings?.apiKeyConfigured ? "Enter new key..." : "sk-or-v1-..."}
              hint={settings?.apiKeyConfigured ? `Current: ${settings.apiKey}` : undefined}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
            <ModelSelect
              value={model}
              onChange={onModelChange}
              models={POPULAR_MODELS}
              allowCustom
            />
            {model === "custom" && (
              <div className="mt-2">
                <Input
                  value={customModel}
                  onChange={(e) => onCustomModelChange(e.target.value)}
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
      {settings?.apiKeyConfigured && estimate && (
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

      <InfoBox>Source language is auto-detected. Translations are saved and apply to all matching content.</InfoBox>
    </div>
  );
}
