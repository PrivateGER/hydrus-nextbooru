import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import {
  getOpenRouterSettings,
  estimateTranslationCost,
  formatCost,
} from "@/lib/openrouter";
import { OpenRouterClient } from "@/lib/openrouter";

/**
 * Get cost estimate for translating all untranslated group titles.
 *
 * Returns the count of untranslated titles, estimated token usage,
 * and estimated cost based on the configured model's pricing.
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getOpenRouterSettings();

    if (!settings.apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 401 }
      );
    }

    const model = settings.model || OpenRouterClient.getDefaultModel();

    // Find all unique untranslated titles (filter whitespace-only titles)
    // Groups that have a title but no corresponding translation
    const untranslatedTitles = await prisma.$queryRaw<
      { titleHash: string; title: string }[]
    >`
      SELECT DISTINCT g."titleHash", g.title
      FROM "Group" g
      WHERE g."titleHash" IS NOT NULL
        AND g.title IS NOT NULL
        AND TRIM(g.title) != ''
        AND NOT EXISTS (
          SELECT 1 FROM "ContentTranslation" ct
          WHERE ct."contentHash" = g."titleHash"
        )
    `;

    // Also get total stats (filter whitespace-only titles)
    const stats = await prisma.$queryRaw<
      { total: bigint; translated: bigint; untranslated: bigint }[]
    >`
      SELECT
        COUNT(DISTINCT g."titleHash") FILTER (WHERE g."titleHash" IS NOT NULL) as total,
        COUNT(DISTINCT g."titleHash") FILTER (
          WHERE g."titleHash" IS NOT NULL
          AND EXISTS (SELECT 1 FROM "ContentTranslation" ct WHERE ct."contentHash" = g."titleHash")
        ) as translated,
        COUNT(DISTINCT g."titleHash") FILTER (
          WHERE g."titleHash" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "ContentTranslation" ct WHERE ct."contentHash" = g."titleHash")
        ) as untranslated
      FROM "Group" g
      WHERE g.title IS NOT NULL AND TRIM(g.title) != ''
    `;

    const titles = untranslatedTitles.map((t) => t.title);
    const estimate = await estimateTranslationCost(titles, model);

    return NextResponse.json({
      // Stats
      totalUniqueTitles: Number(stats[0]?.total ?? 0),
      translatedCount: Number(stats[0]?.translated ?? 0),
      untranslatedCount: Number(stats[0]?.untranslated ?? 0),

      // Cost estimate
      uniqueTitlesToTranslate: estimate.uniqueTitles,
      estimatedInputTokens: estimate.estimatedInputTokens,
      estimatedOutputTokens: estimate.estimatedOutputTokens,
      estimatedCost: formatCost(estimate.estimatedCostUsd),
      estimatedCostUsd: estimate.estimatedCostUsd,

      // Model info
      model,
      pricing: {
        inputPer1M: estimate.pricing.input,
        outputPer1M: estimate.pricing.output,
      },
    });
  } catch (error) {
    console.error("Error estimating translation cost:", error);
    return NextResponse.json(
      { error: "Failed to estimate translation cost" },
      { status: 500 }
    );
  }
}
