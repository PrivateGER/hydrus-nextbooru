import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { aiLog } from "@/lib/logger";
import { batchTranslateNotes } from "@/lib/notes-translation";

interface TranslationProgress {
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

const initialProgress: TranslationProgress = {
  status: "idle",
  total: 0,
  completed: 0,
  failed: 0,
  errors: [],
};

let noteTranslationProgress: TranslationProgress = { ...initialProgress };
let noteTranslationLock: Promise<void> | null = null;

// Concurrency control
const MAX_CONCURRENT = 10;
const BATCH_DELAY_MS = 500;
const MAX_ERRORS = 10;

/**
 * Reset note translation progress to initial state.
 * Exported for use in tests.
 */
export function resetNoteTranslationProgress(): void {
  noteTranslationProgress = { ...initialProgress };
  noteTranslationLock = null;
}

/**
 * Get current bulk note translation progress.
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  return NextResponse.json(noteTranslationProgress);
}

/**
 * Start bulk translation of all untranslated note content.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (noteTranslationLock) {
    await noteTranslationLock;
  }

  if (noteTranslationProgress.status === "running") {
    return NextResponse.json(
      { error: "Translation already in progress" },
      { status: 409 }
    );
  }

  let targetLang: string | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text);
      if (typeof body.targetLang === "string" && body.targetLang.trim()) {
        targetLang = body.targetLang.trim();
      }
    }
  } catch {
    // Ignore parse errors and use default target language from settings
  }

  let releaseLock: () => void;
  noteTranslationLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  noteTranslationProgress = {
    status: "running",
    total: 0,
    completed: 0,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };

  runBulkNoteTranslation(targetLang)
    .catch((error) => {
      aiLog.error({ error: String(error) }, "Bulk note translation failed");
    })
    .finally(() => {
      releaseLock!();
      noteTranslationLock = null;
    });

  return NextResponse.json({
    message: "Bulk note translation started",
    status: "running",
  });
}

/**
 * Cancel running note translation.
 */
export async function DELETE() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (noteTranslationProgress.status !== "running") {
    return NextResponse.json(
      { error: "No translation in progress" },
      { status: 400 }
    );
  }

  noteTranslationProgress.status = "cancelled";
  noteTranslationProgress.completedAt = new Date().toISOString();

  return NextResponse.json({
    message: "Translation cancelled",
    progress: noteTranslationProgress,
  });
}

async function runBulkNoteTranslation(targetLang?: string): Promise<void> {
  const result = await batchTranslateNotes({
    targetLang,
    maxConcurrent: MAX_CONCURRENT,
    batchDelayMs: BATCH_DELAY_MS,
    maxErrors: MAX_ERRORS,
    isCancelled: () => noteTranslationProgress.status === "cancelled",
    onProgress: (progress) => {
      noteTranslationProgress.total = progress.total;
      noteTranslationProgress.completed = progress.completed;
      noteTranslationProgress.failed = progress.failed;
      noteTranslationProgress.errors = progress.errors;
    },
  });

  noteTranslationProgress.total = result.total;
  noteTranslationProgress.completed = result.completed;
  noteTranslationProgress.failed = result.failed;
  noteTranslationProgress.errors = result.errors;
  noteTranslationProgress.status = result.status;
  noteTranslationProgress.completedAt = new Date().toISOString();
}
