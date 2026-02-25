import { prisma } from "@/lib/db";
import { OpenRouterClient, OpenRouterConfigError } from "./client";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./base-url";
import {
  SETTINGS_KEYS,
  type OpenRouterSettings,
  type TranslationSettings,
  type LlmProvider,
} from "./types";

/**
 * Load translation configuration from the database.
 */
export async function getTranslationSettings(): Promise<TranslationSettings> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: Object.values(SETTINGS_KEYS),
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  const provider = (settingsMap.get(SETTINGS_KEYS.PROVIDER) as LlmProvider | undefined) || "openrouter";

  return {
    provider,
    targetLang: settingsMap.get(SETTINGS_KEYS.TARGET_LANG) || null,
    openrouter: {
      apiKey: settingsMap.get(SETTINGS_KEYS.API_KEY) || null,
      model: settingsMap.get(SETTINGS_KEYS.MODEL) || null,
      baseUrl: settingsMap.get(SETTINGS_KEYS.BASE_URL) || null,
    },
    local: {
      apiKey: settingsMap.get(SETTINGS_KEYS.LOCAL_API_KEY) || null,
      model: settingsMap.get(SETTINGS_KEYS.LOCAL_MODEL) || null,
      baseUrl: settingsMap.get(SETTINGS_KEYS.LOCAL_BASE_URL) || null,
    },
  };
}

/**
 * Load active provider configuration for translation calls.
 */
export async function getOpenRouterSettings(): Promise<OpenRouterSettings> {
  const settings = await getTranslationSettings();
  const active = settings.provider === "local" ? settings.local : settings.openrouter;

  return {
    apiKey: active.apiKey,
    model: active.model,
    targetLang: settings.targetLang,
    baseUrl:
      active.baseUrl ||
      (settings.provider === "openrouter" ? DEFAULT_BASE_URL : null),
  };
}

/**
 * Upserts a settings entry in the database for the given key with the provided value.
 *
 * @param key - The settings key to create or update
 * @param value - The value to assign to the settings key
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Upserts multiple configuration settings in a single transactional operation.
 *
 * Filters out entries whose value is `undefined` and creates or updates each remaining key/value pair.
 *
 * @param settings - A map of setting keys to values; entries with `undefined` values are ignored. 
 */
export async function updateSettings(
  settings: Partial<Record<string, string>>
): Promise<void> {
  const operations = Object.entries(settings)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value: value! },
        create: { key, value: value! },
      })
    );

  if (operations.length === 0) {
    return;
  }

  await prisma.$transaction(operations);
}

/**
 * Create an OpenRouterClient using configured settings.
 *
 * @returns An initialized OpenRouterClient configured with the resolved API key, model (if present), and default target language (if present).
 * @throws Error if the active provider is missing required settings.
 */
export async function getOpenRouterClient(): Promise<OpenRouterClient> {
  const settings = await getTranslationSettings();
  const active = settings.provider === "local" ? settings.local : settings.openrouter;

  if (settings.provider === "openrouter" && !active.apiKey) {
    throw new OpenRouterConfigError(
      "OpenRouter API key not configured. Set it in Admin Settings."
    );
  }

  if (settings.provider === "openrouter" && active.baseUrl && isCustomEndpoint(active.baseUrl) && !active.model) {
    throw new OpenRouterConfigError(
      "Model not configured for custom OpenRouter endpoint. Set it in Admin Settings."
    );
  }

  if (settings.provider === "local" && !active.model) {
    throw new OpenRouterConfigError(
      "Model not configured for Local provider. Set it in Admin Settings."
    );
  }

  if (settings.provider === "local" && !active.baseUrl) {
    throw new OpenRouterConfigError(
      "Local endpoint not configured. Set it in Admin Settings."
    );
  }

  return new OpenRouterClient({
    apiKey: active.apiKey || "",
    model: active.model || undefined,
    defaultTargetLang: settings.targetLang || undefined,
    baseUrl:
      active.baseUrl ||
      (settings.provider === "openrouter" ? DEFAULT_BASE_URL : undefined),
  });
}

/**
 * Produce a masked representation of an API key for safe display.
 *
 * @param key - The API key to mask.
 * @returns A masked API key: `****` if `key` has 12 or fewer characters, otherwise the first 8 characters, `...`, and the last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return "****";
  }
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * Check whether a base URL points to a custom (non-OpenRouter) endpoint.
 */
export function isCustomEndpoint(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  return normalizeBaseUrl(baseUrl) !== normalizeBaseUrl(DEFAULT_BASE_URL);
}

/**
 * Resolve the effective model for API calls based on endpoint type.
 */
export function getEffectiveModel(settings: OpenRouterSettings): string {
  if (settings.baseUrl && isCustomEndpoint(settings.baseUrl)) {
    if (!settings.model) {
      throw new OpenRouterConfigError(
        "Model not configured for custom OpenRouter endpoint. Set it in Admin Settings."
      );
    }
    return settings.model;
  }

  return settings.model || OpenRouterClient.getDefaultModel();
}
