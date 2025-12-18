import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";

interface TranslateRequestBody {
  sourceLang?: string;
  targetLang?: string;
}

/**
 * Translate a note's content identified by the route `id` and persist translation metadata.
 *
 * Translations are stored in the NoteTranslation table keyed by content hash, so identical
 * note content across different posts shares the same translation.
 *
 * @param request - The incoming NextRequest whose JSON body may include optional `sourceLang` and `targetLang`.
 * @param params - An object with a Promise that resolves to route parameters; expected to contain `id` as a string.
 * @returns A JSON response containing the note with translation data on success, or an error payload on failure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
    }

    const body: TranslateRequestBody = await request.json().catch(() => ({}));

    // Fetch the note with its content hash
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (!note.content.trim()) {
      return NextResponse.json(
        { error: "Note content is empty" },
        { status: 400 }
      );
    }

    // Get OpenRouter client with settings from DB
    const client = await getOpenRouterClient();

    // Translate the content
    const result = await client.translate({
      text: note.content,
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
    });

    // Upsert translation into NoteTranslation table (shared by all notes with same content)
    const translation = await prisma.noteTranslation.upsert({
      where: { contentHash: note.contentHash },
      create: {
        contentHash: note.contentHash,
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

    aiLog.info({ noteId, contentHash: note.contentHash }, 'Translation saved to NoteTranslation table');

    return NextResponse.json({
      id: note.id,
      name: note.name,
      content: note.content,
      translatedContent: translation.translatedContent,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      translatedAt: translation.translatedAt?.toISOString(),
    });
  } catch (error) {
    aiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Error translating note');

    if (error instanceof OpenRouterApiError) {
      return NextResponse.json(
        { error: `Translation failed: ${error.message}` },
        { status: error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500 }
      );
    }

    if (error instanceof Error) {
      // Handle configuration errors
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to translate note" },
      { status: 500 }
    );
  }
}