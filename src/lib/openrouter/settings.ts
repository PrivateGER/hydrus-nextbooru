import { prisma } from "@/lib/db";
import { OpenRouterClient } from "./client";
import { SETTINGS_KEYS, type OpenRouterSettings } from "./types";

/**
 * Fetch OpenRouter settings from database with environment variable fallback
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
 * Update a single setting in the database
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Update multiple settings at once
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

  await prisma.$transaction(operations);
}

/**
 * Delete a setting from the database
 */
export async function deleteSetting(key: string): Promise<void> {
  await prisma.settings.deleteMany({ where: { key } });
}

/**
 * Create an OpenRouter client with settings from database
 * Falls back to environment variables if database settings are not configured
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
 * Mask an API key for display (show first 8 and last 4 characters)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return "****";
  }
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
