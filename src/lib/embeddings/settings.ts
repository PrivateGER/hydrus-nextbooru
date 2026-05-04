import { DEFAULT_BASE_URL, isCustomEndpointUrl, normalizeBaseUrl } from "@/lib/openrouter/base-url";
import { prisma } from "@/lib/db";
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION_OPTIONS,
  EMBEDDING_RESOLUTION_OPTIONS,
  SETTINGS_KEYS,
  type OpenRouterSettings,
} from "@/lib/openrouter/types";
import { maskApiKey, updateSettings } from "@/lib/openrouter/settings";

const MAX_EMBEDDING_BASE_URL_LENGTH = 2048;

export interface EmbeddingSettings {
  apiKey: string | null;
  apiKeyConfigured: boolean;
  apiKeyRequired: boolean;
  maskedApiKey: string | null;
  baseUrl: string;
  model: string;
  dimensions: number;
  imageMaxResolution: number;
}

export interface EmbeddingConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  imageMaxResolution: number;
}

export function isSupportedEmbeddingDimensions(value: number): value is typeof EMBEDDING_DIMENSION_OPTIONS[number] {
  return (EMBEDDING_DIMENSION_OPTIONS as readonly number[]).includes(value);
}

export function isSupportedEmbeddingResolution(value: number): value is typeof EMBEDDING_RESOLUTION_OPTIONS[number] {
  return (EMBEDDING_RESOLUTION_OPTIONS as readonly number[]).includes(value);
}

export function normalizeEmbeddingBaseUrl(baseUrl: string | null | undefined): string {
  const trimmed = baseUrl?.trim();
  return normalizeBaseUrl(trimmed ? trimmed : DEFAULT_BASE_URL);
}

export function isEmbeddingApiKeyRequired(baseUrl: string | null | undefined): boolean {
  return !isCustomEndpointUrl(normalizeEmbeddingBaseUrl(baseUrl));
}

export function isEmbeddingProviderConfigured(settings: Pick<EmbeddingSettings, "apiKey" | "baseUrl">): boolean {
  return Boolean(settings.apiKey) || !isEmbeddingApiKeyRequired(settings.baseUrl);
}

export function toEmbeddingConfig(settings: Pick<EmbeddingSettings, "baseUrl" | "model" | "dimensions" | "imageMaxResolution">): EmbeddingConfig {
  return {
    baseUrl: normalizeEmbeddingBaseUrl(settings.baseUrl),
    model: settings.model,
    dimensions: settings.dimensions,
    imageMaxResolution: settings.imageMaxResolution,
  };
}

function parseIntegerSetting(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getEmbeddingSettings(): Promise<EmbeddingSettings> {
  const rows = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          SETTINGS_KEYS.API_KEY,
          SETTINGS_KEYS.BASE_URL,
          SETTINGS_KEYS.EMBEDDING_MODEL,
          SETTINGS_KEYS.EMBEDDING_DIMENSIONS,
          SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION,
        ],
      },
    },
  });

  const settings = new Map(rows.map((row) => [row.key, row.value]));

  const apiKey = settings.get(SETTINGS_KEYS.API_KEY) || null;
  const baseUrl = normalizeEmbeddingBaseUrl(settings.get(SETTINGS_KEYS.BASE_URL) || DEFAULT_BASE_URL);
  const dimensions = parseIntegerSetting(settings.get(SETTINGS_KEYS.EMBEDDING_DIMENSIONS) || null, DEFAULT_EMBEDDING_DIMENSIONS);
  const imageMaxResolution = parseIntegerSetting(
    settings.get(SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION) || null,
    DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION
  );

  const safeDimensions = isSupportedEmbeddingDimensions(dimensions)
    ? dimensions
    : DEFAULT_EMBEDDING_DIMENSIONS;
  const safeResolution = isSupportedEmbeddingResolution(imageMaxResolution)
    ? imageMaxResolution
    : DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION;

  return {
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyRequired: isEmbeddingApiKeyRequired(baseUrl),
    maskedApiKey: apiKey ? maskApiKey(apiKey) : null,
    baseUrl,
    model: settings.get(SETTINGS_KEYS.EMBEDDING_MODEL) || DEFAULT_EMBEDDING_MODEL,
    dimensions: safeDimensions,
    imageMaxResolution: safeResolution,
  };
}

export async function getEmbeddingOpenRouterSettings(): Promise<OpenRouterSettings & EmbeddingConfig> {
  const settings = await getEmbeddingSettings();

  return {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    targetLang: null,
    dimensions: settings.dimensions,
    imageMaxResolution: settings.imageMaxResolution,
  };
}

export async function updateEmbeddingSettings(input: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  imageMaxResolution?: number;
}): Promise<void> {
  const settings: Partial<Record<string, string>> = {};

  if (input.apiKey !== undefined) {
    settings[SETTINGS_KEYS.API_KEY] = input.apiKey.trim();
  }

  if (input.baseUrl !== undefined) {
    const baseUrl = normalizeEmbeddingBaseUrl(input.baseUrl);
    if (baseUrl.length > MAX_EMBEDDING_BASE_URL_LENGTH) {
      throw new Error(`Embedding base URL must be ${MAX_EMBEDDING_BASE_URL_LENGTH} characters or fewer`);
    }
    settings[SETTINGS_KEYS.BASE_URL] = baseUrl;
  }

  if (input.model !== undefined) {
    const model = input.model.trim();
    if (!model) {
      throw new Error("Embedding model is required");
    }
    settings[SETTINGS_KEYS.EMBEDDING_MODEL] = model;
  }

  if (input.dimensions !== undefined) {
    if (!isSupportedEmbeddingDimensions(input.dimensions)) {
      throw new Error(`Embedding dimensions must be one of: ${EMBEDDING_DIMENSION_OPTIONS.join(", ")}`);
    }
    settings[SETTINGS_KEYS.EMBEDDING_DIMENSIONS] = String(input.dimensions);
  }

  if (input.imageMaxResolution !== undefined) {
    if (!isSupportedEmbeddingResolution(input.imageMaxResolution)) {
      throw new Error(`Image resolution must be one of: ${EMBEDDING_RESOLUTION_OPTIONS.join(", ")}`);
    }
    settings[SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION] = String(input.imageMaxResolution);
  }

  await updateSettings(settings);
}
