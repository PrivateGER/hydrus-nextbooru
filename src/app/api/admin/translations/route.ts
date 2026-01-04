import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import {
  getOpenRouterClient,
  OpenRouterApiError,
  OpenRouterConfigError,
} from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";

// In-memory state for bulk translation progress
interface TranslationProgress {
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

let translationProgress: TranslationProgress = {
  status: "idle",
  total: 0,
  completed: 0,
  failed: 0,
  errors: [],
};

// Concurrency control
const MAX_CONCURRENT = 5;
const BATCH_DELAY_MS = 100;

/**
 * Get current translation progress.
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  return NextResponse.json(translationProgress);
}

/**
 * Start bulk translation of all untranslated group titles.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  // Check if already running
  if (translationProgress.status === "running") {
    return NextResponse.json(
      { error: "Translation already in progress" },
      { status: 409 }
    );
  }

  // Parse optional body
  let targetLang: string | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text);
      targetLang = body.targetLang;
    }
  } catch {
    // Ignore parse errors, use defaults
  }

  // Start background job
  runBulkTranslation(targetLang).catch((error) => {
    aiLog.error({ error: String(error) }, "Bulk translation failed");
  });

  return NextResponse.json({
    message: "Bulk translation started",
    status: "running",
  });
}

/**
 * Cancel running translation.
 */
export async function DELETE() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (translationProgress.status !== "running") {
    return NextResponse.json(
      { error: "No translation in progress" },
      { status: 400 }
    );
  }

  translationProgress.status = "cancelled";

  return NextResponse.json({
    message: "Translation cancelled",
    progress: translationProgress,
  });
}

/**
 * Run bulk translation in the background.
 */
async function runBulkTranslation(targetLang?: string): Promise<void> {
  // Reset progress
  translationProgress = {
    status: "running",
    total: 0,
    completed: 0,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };

  try {
    // Get OpenRouter client
    const client = await getOpenRouterClient();

    // Find all unique untranslated titles
    const untranslatedTitles = await prisma.$queryRaw<
      { titleHash: string; title: string }[]
    >`
      SELECT DISTINCT g."titleHash", g.title
      FROM "Group" g
      WHERE g."titleHash" IS NOT NULL
        AND g.title IS NOT NULL
        AND g.title != ''
        AND NOT EXISTS (
          SELECT 1 FROM "ContentTranslation" ct
          WHERE ct."contentHash" = g."titleHash"
        )
    `;

    translationProgress.total = untranslatedTitles.length;

    if (untranslatedTitles.length === 0) {
      translationProgress.status = "completed";
      translationProgress.completedAt = new Date().toISOString();
      return;
    }

    aiLog.info(
      { count: untranslatedTitles.length },
      "Starting bulk title translation"
    );

    // Process in batches with concurrency limit
    for (let i = 0; i < untranslatedTitles.length; i += MAX_CONCURRENT) {
      // Check for cancellation
      if (translationProgress.status === "cancelled") {
        aiLog.info("Bulk translation cancelled by user");
        return;
      }

      const batch = untranslatedTitles.slice(i, i + MAX_CONCURRENT);

      const results = await Promise.allSettled(
        batch.map(async ({ titleHash, title }) => {
          try {
            // Translate the title
            const result = await client.translate({
              text: title,
              targetLang,
            });

            // Store translation
            await prisma.contentTranslation.upsert({
              where: { contentHash: titleHash },
              create: {
                contentHash: titleHash,
                translatedContent: result.translatedText,
                sourceLanguage: result.sourceLang,
                targetLanguage: result.targetLang,
                translatedAt: new Date(),
              },
              update: {
                translatedContent: result.translatedText,
                sourceLanguage: result.sourceLang,
                targetLanguage: result.targetLang,
                translatedAt: new Date(),
              },
            });

            return { success: true, titleHash };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return { success: false, titleHash, error: message };
          }
        })
      );

      // Update progress
      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            translationProgress.completed++;
          } else {
            translationProgress.failed++;
            if (translationProgress.errors.length < 10) {
              translationProgress.errors.push(
                `${result.value.titleHash}: ${result.value.error}`
              );
            }
          }
        } else {
          translationProgress.failed++;
          if (translationProgress.errors.length < 10) {
            translationProgress.errors.push(result.reason?.message || "Unknown error");
          }
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + MAX_CONCURRENT < untranslatedTitles.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    translationProgress.status = "completed";
    translationProgress.completedAt = new Date().toISOString();

    aiLog.info(
      {
        completed: translationProgress.completed,
        failed: translationProgress.failed,
      },
      "Bulk title translation completed"
    );
  } catch (error) {
    translationProgress.status = "error";
    translationProgress.completedAt = new Date().toISOString();

    if (error instanceof OpenRouterConfigError) {
      translationProgress.errors.push(error.message);
    } else if (error instanceof OpenRouterApiError) {
      translationProgress.errors.push(`API error: ${error.message}`);
    } else {
      translationProgress.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    aiLog.error({ error: String(error) }, "Bulk translation error");
  }
}
