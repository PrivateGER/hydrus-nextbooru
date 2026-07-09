import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog } from "@/lib/logger";
import {
  getOpenRouterSettings,
  getTranslationSettings,
  estimateTranslationCost,
  formatCost,
  getEffectiveModel,
  OpenRouterConfigError,
} from "@/lib/openrouter";

/**
 * Get cost estimate for translating all untranslated note content.
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const translationSettings = await getTranslationSettings();
    const settings = await getOpenRouterSettings();
    const isLocalProvider = translationSettings.provider === "local";

    if (!isLocalProvider && !settings.apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 401 }
      );
    }

    const model = getEffectiveModel(settings);

    const untranslatedNotes = await prisma.$queryRaw<
      { contentHash: string; content: string }[]
    >`
      SELECT DISTINCT n."contentHash", n.content
      FROM "Note" n
      WHERE TRIM(n.content) != ''
        AND NOT EXISTS (
          SELECT 1
          FROM "ContentTranslation" ct
          WHERE ct."contentHash" = n."contentHash"
        )
    `;

    const stats = await prisma.$queryRaw<
      { total: bigint; translated: bigint; untranslated: bigint }[]
    >`
      SELECT
        COUNT(DISTINCT n."contentHash") as total,
        COUNT(DISTINCT n."contentHash") FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "ContentTranslation" ct
            WHERE ct."contentHash" = n."contentHash"
          )
        ) as translated,
        COUNT(DISTINCT n."contentHash") FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM "ContentTranslation" ct
            WHERE ct."contentHash" = n."contentHash"
          )
        ) as untranslated
      FROM "Note" n
      WHERE TRIM(n.content) != ''
    `;

    const noteContents = untranslatedNotes.map((n) => n.content);
    const estimate = await estimateTranslationCost(noteContents, model);

    return NextResponse.json({
      totalUniqueNotes: Number(stats[0]?.total ?? 0),
      translatedCount: Number(stats[0]?.translated ?? 0),
      untranslatedCount: Number(stats[0]?.untranslated ?? 0),
      uniqueNotesToTranslate: estimate.uniqueTitles,
      estimatedInputTokens: estimate.estimatedInputTokens,
      estimatedOutputTokens: estimate.estimatedOutputTokens,
      estimatedCost: isLocalProvider ? "?" : formatCost(estimate.estimatedCostUsd),
      estimatedCostUsd: isLocalProvider ? 0 : estimate.estimatedCostUsd,
      model,
      pricing: {
        inputPer1M: estimate.pricing.input,
        outputPer1M: estimate.pricing.output,
      },
    });
  } catch (error) {
    if (error instanceof OpenRouterConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Error estimating note translation cost");
    return NextResponse.json(
      { error: "Failed to estimate note translation cost" },
      { status: 500 }
    );
  }
}
