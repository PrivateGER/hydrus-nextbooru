import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { getTranslationSettings, OpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";
import { apiLog } from "@/lib/logger";

/**
 * Fetch available models from the configured local endpoint.
 */
export async function GET(request?: Request) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getTranslationSettings();
    const baseUrlOverride = request
      ? new URL(request.url).searchParams.get("baseUrl")?.trim()
      : undefined;
    const localBaseUrl = baseUrlOverride || settings.local.baseUrl;

    if (!localBaseUrl) {
      return NextResponse.json(
        { error: "Local endpoint not configured" },
        { status: 400 }
      );
    }

    const client = new OpenRouterClient({
      apiKey: settings.local.apiKey || "",
      baseUrl: localBaseUrl,
    });

    const models = await client.listModels();

    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof OpenRouterApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to fetch custom models"
    );
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
