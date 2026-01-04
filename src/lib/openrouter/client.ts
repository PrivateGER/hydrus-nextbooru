import type {
  OpenRouterClientConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  TranslationRequest,
  TranslationResult,
  ImageTranslationRequest,
  ImageTranslationResult,
} from "./types";
import { aiLog } from "@/lib/logger";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_TARGET_LANG = "en";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  it: "Italian",
  ar: "Arabic",
  th: "Thai",
  vi: "Vietnamese",
};

export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private defaultTargetLang: string;

  constructor(config: OpenRouterClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODEL;
    this.defaultTargetLang = config.defaultTargetLang || DEFAULT_TARGET_LANG;

    if (!this.apiKey) {
      throw new OpenRouterConfigError(
        "OpenRouter API key is required. Configure it in Admin Settings."
      );
    }
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.model;
    const startTime = Date.now();
    aiLog.debug({ model }, 'OpenRouter API request');

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/PrivateGER/hydrus-nextbooru",
        "X-Title": "Nextbooru",
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.max_tokens ?? 2048,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      aiLog.error({ model, status: response.status, body: errorText.slice(0, 500), durationMs }, 'OpenRouter API error');
      throw new OpenRouterApiError(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    aiLog.debug({ model, status: response.status, durationMs }, 'OpenRouter API response');

    return response.json() as Promise<ChatCompletionResponse>;
  }

  /**
   * Translate text to target language with auto-detected source language
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const targetLang = request.targetLang || this.defaultTargetLang;
    const targetLangName = this.getLanguageName(targetLang);

    const systemPrompt = `You are a professional translator. Your task:
1. First, identify the source language of the text
2. Then translate it to ${targetLangName}. Use Markdown for formatting purposes.

Output format (exactly):
LANGUAGE: <language name in English>
TRANSLATION:
<translated text>

Preserve the original formatting, line breaks, and tone in the translation.`;

    const completion = await this.chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: request.text },
      ],
    });

    const response = completion.choices[0]?.message?.content?.trim() || "";

    if (!response) {
      throw new OpenRouterApiError("No translation returned from API", 500);
    }

    // Parse the response
    const languageMatch = response.match(/^LANGUAGE:\s*(.+)$/m);
    const translationMatch = response.match(/TRANSLATION:\s*([\s\S]+)$/m);

    const detectedLang = languageMatch?.[1]?.trim() || "Unknown";
    const translatedText = translationMatch?.[1]?.trim() || response;

    // Convert language name to code if possible
    const sourceLangCode = this.getLanguageCode(detectedLang) || detectedLang.toLowerCase();

    return {
      translatedText,
      sourceLang: sourceLangCode,
      targetLang,
    };
  }

  /**
   * Translate text visible in an image to target language
   */
  async translateImage(request: ImageTranslationRequest): Promise<ImageTranslationResult> {
    const targetLang = request.targetLang || this.defaultTargetLang;
    const targetLangName = this.getLanguageName(targetLang);

    const response = await this.chatCompletion({
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Look at the image and:
1. Identify any text visible in the image
2. Identify the language of the text
3. Translate all text to ${targetLangName}. 

Do not include any original text in your response. 
Use Markdown for formatting purposes.
If excessively long onomatopoeia are used or repeated >5 times in a row, limit their length.
Keep the translation easy to read, change ordering and formatting if necessary for clarity.

If there is no text in the image, respond with exactly:
NO_TEXT

If there is text, respond with this exact format:
LANGUAGE: <source language name in English>
TRANSLATION:
<translated text, preserving layout/structure where reasonable>`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: request.imageUrl },
            },
            {
              type: "text",
              text: "Please identify and translate any text in this image.",
            },
          ],
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";

    if (!responseText) {
      throw new OpenRouterApiError("No response returned from API", 500);
    }

    // Check if no text was found (be strict to avoid dropping legitimate translations)
    const normalized = responseText.trim().toUpperCase();
    if (normalized === "NO_TEXT" || normalized === "NO TEXT") {
      return {
        translatedText: "",
        sourceLang: "",
        targetLang,
        hasText: false,
      };
    }

    // Parse the response
    const languageMatch = responseText.match(/^LANGUAGE:\s*(.+)$/m);
    const translationMatch = responseText.match(/TRANSLATION:\s*([\s\S]+)$/m);

    const detectedLang = languageMatch?.[1]?.trim() || "Unknown";
    const translatedText = translationMatch?.[1]?.trim() || responseText;

    const sourceLangCode = this.getLanguageCode(detectedLang) || detectedLang.toLowerCase();

    return {
      translatedText,
      sourceLang: sourceLangCode,
      targetLang,
      hasText: true,
    };
  }

  private getLanguageCode(name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const [code, langName] of Object.entries(LANGUAGE_NAMES)) {
      if (langName.toLowerCase() === lowerName) {
        return code;
      }
    }
    return null;
  }

  private getLanguageName(code: string): string {
    return LANGUAGE_NAMES[code.toLowerCase()] || code;
  }

  /**
   * Get default model
   */
  static getDefaultModel(): string {
    return DEFAULT_MODEL;
  }

  /**
   * Get default target language
   */
  static getDefaultTargetLang(): string {
    return DEFAULT_TARGET_LANG;
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): { code: string; name: string }[] {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
  }
}

export class OpenRouterApiError extends Error {
  public statusCode: number;
  public responseBody?: string;

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.name = "OpenRouterApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}
