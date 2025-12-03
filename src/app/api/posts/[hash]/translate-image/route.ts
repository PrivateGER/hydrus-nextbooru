import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getOpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";
import { buildFilePath } from "@/lib/hydrus/paths";

interface TranslateImageRequestBody {
  targetLang?: string;
}

/**
 * Translate a stored image identified by the route `hash` and return its translated text and language metadata.
 *
 * @param request - Incoming request whose JSON body may include `targetLang` to request a specific target language.
 * @param params - A promise resolving to route parameters; `params.hash` must be a 64-character hexadecimal string identifying the post.
 * @returns On success, a JSON object with `hash`, `translatedText`, `sourceLanguage`, `targetLanguage`, and `hasText`. On failure, a JSON error message is returned with an appropriate HTTP status code (400 for bad input, 404 for missing post or file, 401 for API-key issues, 500 for internal or translation failures, or the upstream API status code when available).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Validate hash format
    if (!/^[a-fA-F0-9]{64}$/i.test(hash)) {
      return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
    }

    const body: TranslateImageRequestBody = await request.json().catch(() => ({}));

    // Fetch the post to verify it exists and get the file info
    const post = await prisma.post.findUnique({
      where: { hash: hash.toLowerCase() },
      select: { id: true, hash: true, mimeType: true, extension: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only allow image types
    if (!post.mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only images can be translated" },
        { status: 400 }
      );
    }

    // Read the image file and convert to base64
    const filePath = buildFilePath(post.hash, post.extension);
    let imageData: Buffer;
    try {
      imageData = await readFile(filePath);
    } catch {
      return NextResponse.json(
        { error: "Image file not found" },
        { status: 404 }
      );
    }

    const base64 = imageData.toString("base64");
    const dataUrl = `data:${post.mimeType};base64,${base64}`;

    // Get OpenRouter client
    const client = await getOpenRouterClient();

    // Translate the image
    const result = await client.translateImage({
      imageUrl: dataUrl,
      targetLang: body.targetLang,
    });

    // Save the translation to the database
    if (result.hasText) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          imageTranslatedText: result.translatedText,
          imageSourceLanguage: result.sourceLang,
          imageTargetLanguage: result.targetLang,
          imageTranslatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      hash: post.hash,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
      hasText: result.hasText,
    });
  } catch (error) {
    console.error("Error translating image:", error);

    if (error instanceof OpenRouterApiError) {
      return NextResponse.json(
        { error: `Translation failed: ${error.message}` },
        { status: error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }

    return NextResponse.json(
      { error: "Failed to translate image" },
      { status: 500 }
    );
  }
}