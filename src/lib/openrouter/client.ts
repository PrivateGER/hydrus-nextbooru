import type {
  OpenRouterClientConfig,
  ChatCompletionRequest,
  ChatCompletionChoice,
  ChatCompletionResponse,
  TranslationRequest,
  TranslationResult,
  ImageTranslationRequest,
  ImageTranslationResult,
} from "./types";
import { aiLog } from "@/lib/logger";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./base-url";

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
  private baseUrl: string;
  private isOpenRouter: boolean;

  constructor(config: OpenRouterClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODEL;
    this.defaultTargetLang = config.defaultTargetLang || DEFAULT_TARGET_LANG;
    this.baseUrl = normalizeBaseUrl(config.baseUrl || DEFAULT_BASE_URL);
    this.isOpenRouter =
      this.baseUrl === normalizeBaseUrl(DEFAULT_BASE_URL);

    if (!this.apiKey && this.isOpenRouter) {
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

    const response = await fetch(this.getUrl("responses"), {
      method: "POST",
      headers: this.getHeaders(true),
      body: JSON.stringify({
        model,
        input: request.messages,
        temperature: request.temperature ?? 0.3,
        max_output_tokens: request.max_tokens ?? 2048,
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

    const data = (await response.json()) as unknown;
    return this.normalizeChatResponse(data, model);
  }

  /**
   * Fetch available models from the API.
   */
  async listModels(): Promise<{ id: string; name: string }[]> {
    const response = await fetch(this.getUrl("models"), {
      headers: this.getHeaders(false),
    });

    if (!response.ok) {
      const errorText = await response.text();
      aiLog.error({ status: response.status, body: errorText.slice(0, 500) }, "OpenRouter models error");
      throw new OpenRouterApiError(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    type ModelListEntry = {
      id?: string;
      key?: string;
      name?: string;
      display_name?: string;
    };

    const data = (await response.json()) as {
      data?: ModelListEntry[];
      models?: ModelListEntry[];
    };

    const models: ModelListEntry[] =
      data.data ??
      data.models ??
      (Array.isArray(data) ? (data as ModelListEntry[]) : []);

    return models
      .map((model) => {
        const id = model.id || model.key;
        if (!id) return null;
        return {
          id,
          name: model.name || model.display_name || id,
        };
      })
      .filter((model): model is { id: string; name: string } => model !== null);
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

  private normalizeChatResponse(
    data: unknown,
    model: string
  ): ChatCompletionResponse {
    if (
      data &&
      typeof data === "object" &&
      "choices" in data &&
      Array.isArray((data as { choices?: unknown }).choices)
    ) {
      const choices = (data as { choices: unknown[] }).choices;
      const hasValidChoices = choices.length > 0
        && choices.every((choice) => this.isChatCompletionChoice(choice));

      if (hasValidChoices) {
        return data as ChatCompletionResponse;
      }

      aiLog.warn(
        { model, choicesLength: choices.length },
        "OpenRouter response choices were invalid; using normalized fallback"
      );
    }

    const text = this.extractResponseText(data);

    return {
      id: typeof (data as { id?: string })?.id === "string" ? (data as { id?: string }).id! : "response",
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: text,
          },
          finish_reason: "stop",
        },
      ],
    };
  }

  private isChatCompletionChoice(choice: unknown): choice is ChatCompletionChoice {
    if (!choice || typeof choice !== "object") {
      return false;
    }

    const candidate = choice as {
      index?: unknown;
      finish_reason?: unknown;
      message?: unknown;
    };

    if (typeof candidate.index !== "number" || typeof candidate.finish_reason !== "string") {
      return false;
    }

    if (!candidate.message || typeof candidate.message !== "object") {
      return false;
    }

    const message = candidate.message as { role?: unknown; content?: unknown };
    return typeof message.role === "string" && typeof message.content === "string";
  }

  private extractResponseText(data: unknown): string {
    if (!data || typeof data !== "object") return "";

    const directText = (data as { output_text?: string }).output_text;
    if (typeof directText === "string") {
      return directText;
    }

    const output = (data as { output?: unknown }).output;
    if (Array.isArray(output)) {
      for (const item of output) {
        if (item && typeof item === "object") {
          const content = (item as { content?: unknown }).content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part && typeof part === "object") {
                const type = (part as { type?: string }).type;
                const text = (part as { text?: string }).text;
                if ((type === "output_text" || type === "text") && typeof text === "string") {
                  return text;
                }
              }
            }
          }
        }
      }
    }

    return "";
  }

  /**
   * Get default model
   */
  static getDefaultModel(): string {
    return DEFAULT_MODEL;
  }

  /**
   * Get default API base URL.
   */
  static getDefaultBaseUrl(): string {
    return DEFAULT_BASE_URL;
  }

  /**
   * Normalize a base URL for comparisons and joins.
   */
  static normalizeBaseUrl(baseUrl: string): string {
    return normalizeBaseUrl(baseUrl);
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

  private getUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, "")}`;
  }

  private getHeaders(includeContentType: boolean): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (includeContentType) {
      headers["Content-Type"] = "application/json";
    }

    if (this.isOpenRouter) {
      headers["HTTP-Referer"] = "https://github.com/PrivateGER/hydrus-nextbooru";
      headers["X-Title"] = "Nextbooru";
    }

    return headers;
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
