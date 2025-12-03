import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterSettings,
  updateSettings,
  maskApiKey,
  SETTINGS_KEYS,
} from "@/lib/openrouter";
import { OpenRouterClient } from "@/lib/openrouter";

interface SettingsUpdateBody {
  apiKey?: string;
  model?: string;
  targetLang?: string;
}

// GET - Get current settings (with masked API key)
export async function GET() {
  try {
    const settings = await getOpenRouterSettings();

    return NextResponse.json({
      apiKey: settings.apiKey ? maskApiKey(settings.apiKey) : null,
      apiKeyConfigured: !!settings.apiKey,
      model: settings.model || OpenRouterClient.getDefaultModel(),
      targetLang: settings.targetLang || OpenRouterClient.getDefaultTargetLang(),
      // Include available options for the UI
      supportedLanguages: OpenRouterClient.getSupportedLanguages(),
      defaultModel: OpenRouterClient.getDefaultModel(),
    });
  } catch (error) {
    console.error("Error getting settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body: SettingsUpdateBody = await request.json();

    const updates: Record<string, string> = {};

    // Only update fields that are provided
    if (body.apiKey !== undefined && body.apiKey !== "") {
      updates[SETTINGS_KEYS.API_KEY] = body.apiKey;
    }
    if (body.model !== undefined) {
      updates[SETTINGS_KEYS.MODEL] = body.model;
    }
    if (body.targetLang !== undefined) {
      updates[SETTINGS_KEYS.TARGET_LANG] = body.targetLang;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No settings to update" },
        { status: 400 }
      );
    }

    await updateSettings(updates);

    // Fetch updated settings to return
    const settings = await getOpenRouterSettings();

    return NextResponse.json({
      message: "Settings updated successfully",
      apiKey: settings.apiKey ? maskApiKey(settings.apiKey) : null,
      apiKeyConfigured: !!settings.apiKey,
      model: settings.model || OpenRouterClient.getDefaultModel(),
      targetLang: settings.targetLang || OpenRouterClient.getDefaultTargetLang(),
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
