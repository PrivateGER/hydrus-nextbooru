// OpenRouter API Types

export interface OpenRouterClientConfig {
  apiKey: string;
  model?: string;
  defaultTargetLang?: string;
  baseUrl?: string;
}

export interface ChatMessageText {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatMessageWithImage {
  role: "user";
  content: (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  )[];
}

export type ChatMessage = ChatMessageText | ChatMessageWithImage;

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: "stop" | "length" | "content_filter" | "error" | "tool_calls";
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TranslationRequest {
  text: string;
  sourceLang?: string;
  targetLang?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export interface ImageTranslationRequest {
  imageUrl: string;
  targetLang?: string;
}

export interface ImageTranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  hasText: boolean;
}

export interface TextsTranslationRequest {
  /** Source texts in reading order. */
  texts: string[];
  /** Optional per-text language hints, aligned with texts. */
  sourceLangs?: (string | null)[];
  targetLang?: string;
  /**
   * Optional full-page image for visual translation context. `base64` is the
   * raw image data with no data-URI prefix. Requires a vision-capable model.
   */
  pageImage?: { base64: string; mimeType: string };
}

export interface TextsTranslationResult {
  /** Translations aligned index-for-index with the request texts. */
  translations: string[];
  targetLang: string;
}

export interface EmbeddingContentText {
  type: "text";
  text: string;
}

export interface EmbeddingContentImage {
  type: "image_url";
  image_url: { url: string };
}

export interface EmbeddingMultimodalInput {
  content: (EmbeddingContentText | EmbeddingContentImage)[];
}

export type EmbeddingInput = string | string[] | EmbeddingMultimodalInput[];

export const EMBEDDING_INPUT_TYPES = {
  SEARCH_QUERY: "search_query",
  SEARCH_DOCUMENT: "search_document",
} as const;

export type EmbeddingInputType = typeof EMBEDDING_INPUT_TYPES[keyof typeof EMBEDDING_INPUT_TYPES];

export interface EmbeddingRequest {
  model?: string;
  input: EmbeddingInput;
  dimensions?: number;
  encoding_format?: "float";
  input_type?: EmbeddingInputType;
}

export interface ImageEmbeddingRequest {
  model?: string;
  imageUrl: string;
  dimensions?: number;
}

export interface ImageEmbeddingsRequest {
  model?: string;
  imageUrls: string[];
  dimensions?: number;
}

export interface EmbeddingResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    embedding: number[] | string;
    index?: number;
  }>;
  model: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage?: EmbeddingResponse["usage"];
}

// Settings keys stored in database
export const SETTINGS_KEYS = {
  PROVIDER: "openrouter.provider",
  API_KEY: "openrouter.apiKey",
  MODEL: "openrouter.model",
  TARGET_LANG: "openrouter.targetLang",
  BASE_URL: "openrouter.baseUrl",
  LOCAL_API_KEY: "openrouter.local.apiKey",
  LOCAL_MODEL: "openrouter.local.model",
  LOCAL_BASE_URL: "openrouter.local.baseUrl",
  EMBEDDING_MODEL: "openrouter.embedding.model",
  EMBEDDING_DIMENSIONS: "openrouter.embedding.dimensions",
  EMBEDDING_IMAGE_MAX_RESOLUTION: "openrouter.embedding.imageMaxResolution",
} as const;

export interface OpenRouterSettings {
  apiKey: string | null;
  model: string | null;
  targetLang: string | null;
  baseUrl: string | null;
}

export type LlmProvider = "openrouter" | "local";

export interface ProviderSettings {
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
}

export interface TranslationSettings {
  provider: LlmProvider;
  targetLang: string | null;
  openrouter: ProviderSettings;
  local: ProviderSettings;
}

// Model definitions with capabilities
export interface ModelDefinition {
  id: string;
  name: string;
  vision?: boolean;
  expensive?: boolean;
  dimensions?: number[];
}

export const DEFAULT_CHAT_MODEL = "google/gemini-3-flash-preview";

// Popular models available for selection
export const POPULAR_MODELS: ModelDefinition[] = [
  // Vision models (can translate text in images)
  { id: DEFAULT_CHAT_MODEL, name: "Gemini 3 Flash Preview", vision: true },
  { id: "~google/gemini-pro-latest", name: "Gemini Pro Latest", vision: true, expensive: true },
  { id: "~openai/gpt-mini-latest", name: "GPT Mini Latest", vision: true },
  { id: "~openai/gpt-latest", name: "GPT Latest", vision: true, expensive: true },
  { id: "~anthropic/claude-haiku-latest", name: "Claude Haiku Latest", vision: true },
  { id: "~anthropic/claude-sonnet-latest", name: "Claude Sonnet Latest", vision: true, expensive: true },
  { id: "qwen/qwen3.6-flash", name: "Qwen3.6 Flash", vision: true },
  { id: "mistralai/mistral-medium-3-5", name: "Mistral Medium 3.5", vision: true, expensive: true },
  // Text-only models (notes only)
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
];

export const DEFAULT_EMBEDDING_MODEL = "google/gemini-embedding-2-preview";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION = 1024;

export const EMBEDDING_DIMENSION_OPTIONS = [768, 1536, 3072] as const;
export const EMBEDDING_RESOLUTION_OPTIONS = [512, 768, 1024, 1536, 2048] as const;

export const POPULAR_EMBEDDING_MODELS: ModelDefinition[] = [
  {
    id: DEFAULT_EMBEDDING_MODEL,
    name: "Gemini Embedding 2 Preview",
    vision: true,
    dimensions: [...EMBEDDING_DIMENSION_OPTIONS],
  },
];

/**
 * Check if a model supports vision/image input
 * Unknown models are assumed to support vision (fail at API level if not)
 */
export function modelSupportsVision(modelId: string): boolean {
  const model = POPULAR_MODELS.find((m) => m.id === modelId);
  // If model is in our list, check its vision flag
  // If unknown model, assume it supports vision (let API handle it)
  return model ? model.vision === true : true;
}
