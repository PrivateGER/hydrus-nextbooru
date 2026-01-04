import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenRouterClient, OpenRouterApiError, OpenRouterConfigError } from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";

interface TranslateRequestBody {
  sourceLang?: string;
  targetLang?: string;
}

/**
 * Translate a group's title and persist translation metadata.
 *
 * Translations are stored in the ContentTranslation table keyed by title hash,
 * so identical titles across different groups share the same translation.
 *
 * @param request - The incoming NextRequest whose JSON body may include optional `sourceLang` and `targetLang`.
 * @param params - An object with a Promise that resolves to route parameters; expected to contain `id` as a string.
 * @returns A JSON response containing the group with translation data on success, or an error payload on failure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    let body: TranslateRequestBody = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Fetch the group with its title hash
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!group.title?.trim()) {
      return NextResponse.json(
        { error: "Group has no title to translate" },
        { status: 400 }
      );
    }

    if (!group.titleHash) {
      return NextResponse.json(
        { error: "Group title hash not generated" },
        { status: 500 }
      );
    }

    // Get OpenRouter client with settings from DB
    const client = await getOpenRouterClient();

    // Translate the title
    const result = await client.translate({
      text: group.title,
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
    });

    // Upsert translation into ContentTranslation table (shared by notes and group titles)
    const translation = await prisma.contentTranslation.upsert({
      where: { contentHash: group.titleHash },
      create: {
        contentHash: group.titleHash,
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

    aiLog.info({ groupId, titleHash: group.titleHash }, 'Translation saved to ContentTranslation table');

    return NextResponse.json({
      id: group.id,
      title: group.title,
      translatedTitle: translation.translatedContent,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      translatedAt: translation.translatedAt?.toISOString(),
    });
  } catch (error) {
    aiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Error translating group title');

    if (error instanceof OpenRouterConfigError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof OpenRouterApiError) {
      return NextResponse.json(
        { error: `Translation failed: ${error.message}` },
        { status: error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to translate group title" },
      { status: 500 }
    );
  }
}
