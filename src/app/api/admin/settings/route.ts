import { NextRequest, NextResponse } from "next/server";
import {
  getTranslationSettings,
  updateSettings,
  maskApiKey,
  SETTINGS_KEYS,
} from "@/lib/openrouter";
import { OpenRouterClient } from "@/lib/openrouter";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog } from "@/lib/logger";

interface SettingsUpdateBody {
  provider?: "openrouter" | "local";
  targetLang?: string;
  openrouter?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
  local?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}

function normalizeApiKeyUpdate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Return current translation settings and UI options with stored API keys masked.
 *
 * @returns An object with the current settings:
 * - `provider`: selected provider ("openrouter" | "local")
 * - `openrouter`: masked OpenRouter settings
 * - `local`: masked local endpoint settings
 * - `targetLang`: configured target language or the OpenRouter default target language
 * - `supportedLanguages`: array of supported language codes for the UI
 * - `defaultModel`: the OpenRouter default model
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getTranslationSettings();
    const openrouterBase = settings.openrouter.baseUrl || OpenRouterClient.getDefaultBaseUrl();

    return NextResponse.json({
      provider: settings.provider,
      targetLang: settings.targetLang || OpenRouterClient.getDefaultTargetLang(),
      // Include available options for the UI
      supportedLanguages: OpenRouterClient.getSupportedLanguages(),
      defaultModel: OpenRouterClient.getDefaultModel(),
      openrouter: {
        apiKey: settings.openrouter.apiKey ? maskApiKey(settings.openrouter.apiKey) : null,
        apiKeyConfigured: !!settings.openrouter.apiKey,
        model: settings.openrouter.model || OpenRouterClient.getDefaultModel(),
        baseUrl: openrouterBase,
      },
      local: {
        apiKey: settings.local.apiKey ? maskApiKey(settings.local.apiKey) : null,
        apiKeyConfigured: !!settings.local.apiKey,
        model: settings.local.model || "",
        baseUrl: settings.local.baseUrl || "",
      },
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get translation settings');
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT requests to update OpenRouter settings.
 *
 * @param request - Request whose JSON body may include optional provider settings to update.
 * @returns On success, JSON with `message` and the updated settings. Returns a 400 JSON error when no updatable fields are provided, and a 500 JSON error on failure.
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body: SettingsUpdateBody = await request.json();

    const updates: Record<string, string> = {};

    if (body.provider) {
      updates[SETTINGS_KEYS.PROVIDER] = body.provider;
    }

    if (body.targetLang !== undefined && body.targetLang !== "") {
      updates[SETTINGS_KEYS.TARGET_LANG] = body.targetLang;
    }

    if (body.openrouter) {
      const apiKey = normalizeApiKeyUpdate(body.openrouter.apiKey);
      if (apiKey !== undefined) {
        updates[SETTINGS_KEYS.API_KEY] = apiKey;
      }
      if (body.openrouter.model !== undefined) {
        updates[SETTINGS_KEYS.MODEL] = body.openrouter.model;
      }
      if (body.openrouter.baseUrl !== undefined) {
        updates[SETTINGS_KEYS.BASE_URL] = body.openrouter.baseUrl;
      }
    }

    if (body.local) {
      const apiKey = normalizeApiKeyUpdate(body.local.apiKey);
      if (apiKey !== undefined) {
        updates[SETTINGS_KEYS.LOCAL_API_KEY] = apiKey;
      }
      if (body.local.model !== undefined) {
        updates[SETTINGS_KEYS.LOCAL_MODEL] = body.local.model;
      }
      if (body.local.baseUrl !== undefined) {
        updates[SETTINGS_KEYS.LOCAL_BASE_URL] = body.local.baseUrl;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No settings to update" },
        { status: 400 }
      );
    }

    await updateSettings(updates);

    // Fetch updated settings to return
    const settings = await getTranslationSettings();
    const openrouterBase = settings.openrouter.baseUrl || OpenRouterClient.getDefaultBaseUrl();

    return NextResponse.json({
      message: "Settings updated successfully",
      provider: settings.provider,
      targetLang: settings.targetLang || OpenRouterClient.getDefaultTargetLang(),
      openrouter: {
        apiKey: settings.openrouter.apiKey ? maskApiKey(settings.openrouter.apiKey) : null,
        apiKeyConfigured: !!settings.openrouter.apiKey,
        model: settings.openrouter.model || OpenRouterClient.getDefaultModel(),
        baseUrl: openrouterBase,
      },
      local: {
        apiKey: settings.local.apiKey ? maskApiKey(settings.local.apiKey) : null,
        apiKeyConfigured: !!settings.local.apiKey,
        model: settings.local.model || "",
        baseUrl: settings.local.baseUrl || "",
      },
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to update translation settings');
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
