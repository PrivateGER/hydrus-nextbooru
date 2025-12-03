import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";

interface TranslateRequestBody {
  sourceLang?: string;
  targetLang?: string;
}

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

    // Fetch the note
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

    // Update the note with translation
    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        translatedContent: result.translatedText,
        sourceLanguage: result.sourceLang,
        targetLanguage: result.targetLang,
        translatedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updatedNote.id,
      name: updatedNote.name,
      content: updatedNote.content,
      translatedContent: updatedNote.translatedContent,
      sourceLanguage: updatedNote.sourceLanguage,
      targetLanguage: updatedNote.targetLanguage,
      translatedAt: updatedNote.translatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Error translating note:", error);

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
