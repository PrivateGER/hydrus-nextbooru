import { prisma } from "@/lib/db";
import { OpenRouterClient } from "./client";
import { SETTINGS_KEYS, type OpenRouterSettings } from "./types";

/**
 * Load OpenRouter configuration, preferring values stored in the database and falling back to environment variables.
 *
 * @returns An OpenRouterSettings object with the resolved settings:
 * - `apiKey`: the OpenRouter API key or `null` if not configured
 * - `model`: the OpenRouter model identifier or `null` if not configured
 * - `targetLang`: the default target language or `null` if not configured
 */
export async function getOpenRouterSettings(): Promise<OpenRouterSettings> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: Object.values(SETTINGS_KEYS),
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  return {
    apiKey:
      settingsMap.get(SETTINGS_KEYS.API_KEY) ||
      process.env.OPENROUTER_API_KEY ||
      null,
    model:
      settingsMap.get(SETTINGS_KEYS.MODEL) ||
      process.env.OPENROUTER_MODEL ||
      null,
    targetLang:
      settingsMap.get(SETTINGS_KEYS.TARGET_LANG) ||
      process.env.OPENROUTER_DEFAULT_TARGET_LANG ||
      null,
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
 * Create an OpenRouterClient using configured settings, falling back to environment variables when necessary.
 *
 * @returns An initialized OpenRouterClient configured with the resolved API key, model (if present), and default target language (if present).
 * @throws Error if an API key is not configured in settings or environment variables.
 */
export async function getOpenRouterClient(): Promise<OpenRouterClient> {
  const settings = await getOpenRouterSettings();

  if (!settings.apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Set it in Admin Settings or OPENROUTER_API_KEY environment variable."
    );
  }

  return new OpenRouterClient({
    apiKey: settings.apiKey,
    model: settings.model || undefined,
    defaultTargetLang: settings.targetLang || undefined,
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