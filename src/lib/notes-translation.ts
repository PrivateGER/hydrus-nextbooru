import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  getOpenRouterClient,
  OpenRouterApiError,
  OpenRouterConfigError,
} from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";

export interface BatchTranslateNotesOptions {
  targetLang?: string;
  noteIds?: number[];
  maxConcurrent?: number;
  batchDelayMs?: number;
  maxErrors?: number;
  isCancelled?: () => boolean;
  onProgress?: (progress: BatchTranslateNotesResult) => void;
}

export interface BatchTranslateNotesResult {
  status: "completed" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
}

const DEFAULT_MAX_CONCURRENT = 10;
const DEFAULT_BATCH_DELAY_MS = 500;
const DEFAULT_MAX_ERRORS = 10;

/**
 * Batch-translate note content that does not already have a shared translation.
 *
 * Notes are deduplicated by `contentHash`, so repeated content is translated once.
 */
export async function batchTranslateNotes(
  options: BatchTranslateNotesOptions = {}
): Promise<BatchTranslateNotesResult> {
  const {
    targetLang,
    noteIds,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
    maxErrors = DEFAULT_MAX_ERRORS,
    isCancelled,
    onProgress,
  } = options;
  const concurrency = Math.max(1, Math.floor(maxConcurrent));
  const maxErrorEntries = Math.max(1, Math.floor(maxErrors));
  const scopedNoteIds = noteIds
    ? [...new Set(noteIds)].filter((id) => Number.isSafeInteger(id) && id > 0)
    : undefined;

  if (scopedNoteIds && scopedNoteIds.length === 0) {
    return {
      status: "completed",
      total: 0,
      completed: 0,
      failed: 0,
      errors: [],
    };
  }

  const scopedNoteFilter = scopedNoteIds
    ? Prisma.sql`AND n.id IN (${Prisma.join(scopedNoteIds)})`
    : Prisma.empty;

  const progress: BatchTranslateNotesResult = {
    status: "completed",
    total: 0,
    completed: 0,
    failed: 0,
    errors: [],
  };
  const emitProgress = (): void => {
    onProgress?.({
      status: progress.status,
      total: progress.total,
      completed: progress.completed,
      failed: progress.failed,
      errors: [...progress.errors],
    });
  };
  const pushError = (message: string, force = false): void => {
    if (progress.errors.length < maxErrorEntries) {
      progress.errors.push(message);
      return;
    }

    if (force && progress.errors.length > 0) {
      progress.errors[progress.errors.length - 1] = message;
    }
  };

  try {
    const untranslatedNotes = await prisma.$queryRaw<
      { contentHash: string; content: string }[]
    >`
      SELECT DISTINCT n."contentHash", n.content
      FROM "Note" n
      WHERE TRIM(n.content) != ''
        ${scopedNoteFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM "ContentTranslation" ct
          WHERE ct."contentHash" = n."contentHash"
        )
    `;

    progress.total = untranslatedNotes.length;
    emitProgress();

    if (untranslatedNotes.length === 0) {
      return progress;
    }

    const client = await getOpenRouterClient();
    aiLog.info(
      { count: untranslatedNotes.length },
      "Starting batch note translation"
    );

    for (let i = 0; i < untranslatedNotes.length; i += concurrency) {
      if (isCancelled?.()) {
        progress.status = "cancelled";
        emitProgress();
        return progress;
      }

      const batch = untranslatedNotes.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async ({ contentHash, content }) => {
          const translated = await client.translate({
            text: content,
            targetLang,
          });

          await prisma.contentTranslation.upsert({
            where: { contentHash },
            create: {
              contentHash,
              translatedContent: translated.translatedText,
              sourceLanguage: translated.sourceLang,
              targetLanguage: translated.targetLang,
              translatedAt: new Date(),
            },
            update: {
              translatedContent: translated.translatedText,
              sourceLanguage: translated.sourceLang,
              targetLanguage: translated.targetLang,
              translatedAt: new Date(),
            },
          });

          return { contentHash };
        })
      );

      let authError: OpenRouterApiError | null = null;

      for (const result of results) {
        if (result.status === "fulfilled") {
          progress.completed++;
          continue;
        }

        progress.failed++;
        const error =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));

        if (error instanceof OpenRouterApiError && error.statusCode === 401) {
          authError = error;
        }

        pushError(error.message);
      }

      if (authError) {
        progress.status = "error";
        pushError(`Authentication failed: ${authError.message}`, true);
        emitProgress();
        aiLog.error(
          { error: authError.message },
          "Batch note translation aborted due to auth error"
        );
        return progress;
      }

      emitProgress();

      if (i + concurrency < untranslatedNotes.length && batchDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    aiLog.info(
      { completed: progress.completed, failed: progress.failed },
      "Batch note translation completed"
    );
    emitProgress();

    return progress;
  } catch (error) {
    progress.status = "error";
    progress.failed = progress.total - progress.completed;

    if (error instanceof OpenRouterConfigError) {
      pushError(error.message);
    } else if (error instanceof OpenRouterApiError) {
      pushError(`API error: ${error.message}`);
    } else {
      pushError(
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    aiLog.error({ error: String(error) }, "Batch note translation failed");
    emitProgress();
    return progress;
  }
}
