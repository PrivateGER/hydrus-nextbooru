import type {
  OpenRouterClientConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  TranslationRequest,
  TranslationResult,
  ImageTranslationRequest,
  ImageTranslationResult,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingResult,
  ImageEmbeddingRequest,
  ImageEmbeddingsRequest,
  EmbeddingMultimodalInput,
} from "./types";
import { EMBEDDING_INPUT_TYPES } from "./types";
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

    const response = await fetch(this.getUrl("chat/completions"), {
      method: "POST",
      headers: this.getHeaders(true),
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

    const data = await response.json() as ChatCompletionResponse;
    const finishReason = data.choices?.[0]?.finish_reason;

    if (finishReason === "content_filter") {
      aiLog.warn({ model, finishReason, durationMs }, "Response blocked by content filter");
      throw new OpenRouterApiError(
        "Content blocked by the model's content filter",
        451,
      );
    }

    if (finishReason === "error") {
      const errorContent = data.choices?.[0]?.message?.content || "Unknown model error";
      const safePreview = errorContent.length > 100
        ? errorContent.slice(0, 100) + "..."
        : errorContent;
      aiLog.error({ model, finishReason, durationMs, errorContent: safePreview }, "Model returned an error finish reason");
      throw new OpenRouterApiError(
        "Model returned an error",
        502,
      );
    }

    return data;
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

    const data = (await response.json()) as unknown;
    const models = this.extractModelList(data);
    const deduped = new Map<string, { id: string; name: string; nonGeneration: boolean }>();

    for (const model of models) {
      if (!model || typeof model !== "object") {
        continue;
      }

      const candidate = model as Record<string, unknown>;
      const id = this.pickFirstString(candidate.id, candidate.key);
      if (!id) {
        continue;
      }

      const name = this.pickFirstString(candidate.name, candidate.display_name) || id;
      const nonGeneration = this.isLikelyNonGenerationModel(candidate, id);
      const existing = deduped.get(id);

      if (!existing) {
        deduped.set(id, { id, name, nonGeneration });
        continue;
      }

      const keepExistingName = existing.name !== existing.id || name === id;
      deduped.set(id, {
        id,
        name: keepExistingName ? existing.name : name,
        nonGeneration: existing.nonGeneration && nonGeneration,
      });
    }

    const normalizedModels = [...deduped.values()];
    const generationModels = normalizedModels.filter((model) => !model.nonGeneration);
    const selected = generationModels.length > 0 ? generationModels : normalizedModels;

    return selected
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  /**
   * Generate an embedding from text or multimodal input.
   */
  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const results = await this.createEmbeddings(request);
    return results[0];
  }

  /**
   * Generate embeddings from text or multimodal input.
   */
  async createEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResult[]> {
    const model = request.model || this.model;
    const startTime = Date.now();
    const inputCount = this.getEmbeddingInputCount(request.input);
    if (inputCount < 1) {
      throw new RangeError("Embedding input must include at least one item");
    }

    aiLog.debug({ model, dimensions: request.dimensions, inputCount }, "OpenRouter embeddings request");

    const response = await fetch(this.getUrl("embeddings"), {
      method: "POST",
      headers: this.getHeaders(true),
      body: JSON.stringify({
        model,
        input: request.input,
        ...(request.dimensions !== undefined && { dimensions: request.dimensions }),
        encoding_format: request.encoding_format || "float",
        ...(request.input_type && { input_type: request.input_type }),
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      aiLog.error({ model, status: response.status, body: errorText.slice(0, 500), durationMs }, "OpenRouter embeddings error");
      throw new OpenRouterApiError(
        `OpenRouter embeddings error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = (await response.json()) as EmbeddingResponse;
    const responseItems = data.data ?? [];
    const hasExplicitIndexes = responseItems.some((item) => item.index !== undefined);
    const embeddingsByIndex = new Map<number, number[]>();

    if (responseItems.length !== inputCount) {
      throw new OpenRouterApiError("Embedding response did not include every requested input", 502);
    }

    for (const [fallbackIndex, item] of responseItems.entries()) {
      const embedding = item.embedding;
      if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
        throw new OpenRouterApiError("No numeric embedding returned from API", 502);
      }

      const responseIndex = hasExplicitIndexes ? item.index : fallbackIndex;
      if (typeof responseIndex !== "number" || !Number.isInteger(responseIndex)) {
        throw new OpenRouterApiError("Embedding response included invalid indexes", 502);
      }

      embeddingsByIndex.set(responseIndex, embedding);
    }

    const results: EmbeddingResult[] = [];
    for (let index = 0; index < inputCount; index++) {
      const embedding = embeddingsByIndex.get(index);
      if (!embedding) {
        throw new OpenRouterApiError("Embedding response did not include every requested input", 502);
      }
      results.push({
        embedding,
        model: data.model || model,
        usage: data.usage,
      });
    }

    aiLog.debug({
      model: data.model || model,
      dimensions: results[0]?.embedding.length,
      inputCount,
      durationMs,
    }, "OpenRouter embeddings response");

    return results;
  }

  /**
   * Generate an embedding for a single image.
   */
  async createImageEmbedding(request: ImageEmbeddingRequest): Promise<EmbeddingResult> {
    const results = await this.createImageEmbeddings({
      model: request.model,
      imageUrls: [request.imageUrl],
      dimensions: request.dimensions,
    });
    return results[0];
  }

  /**
   * Generate embeddings for multiple images in one embeddings request.
   */
  async createImageEmbeddings(request: ImageEmbeddingsRequest): Promise<EmbeddingResult[]> {
    return this.createEmbeddings({
      model: request.model,
      dimensions: request.dimensions,
      input_type: EMBEDDING_INPUT_TYPES.SEARCH_DOCUMENT,
      input: request.imageUrls.map<EmbeddingMultimodalInput>((imageUrl) => ({
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      })),
    });
  }

  private getEmbeddingInputCount(input: EmbeddingRequest["input"]): number {
    return typeof input === "string" ? 1 : input.length;
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

  private extractModelList(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    const modelPayload = payload as { data?: unknown; models?: unknown };
    if (Array.isArray(modelPayload.data)) {
      return modelPayload.data;
    }

    if (Array.isArray(modelPayload.models)) {
      return modelPayload.models;
    }

    return [];
  }

  private pickFirstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private isLikelyNonGenerationModel(model: Record<string, unknown>, id: string): boolean {
    if (/\b(embedding|embeddings|rerank|reranker|safeguard|moderation|classifier)\b/.test(id.toLowerCase())) {
      return true;
    }

    const type = this.pickFirstString(model.type, model.model_type, model.purpose);
    if (type && /\b(embedding|embeddings|rerank|reranker|safeguard|moderation|classifier)\b/i.test(type)) {
      return true;
    }

    return false;
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
