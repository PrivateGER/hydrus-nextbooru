// OpenRouter API Types

export interface OpenRouterClientConfig {
  apiKey: string;
  model?: string;
  defaultTargetLang?: string;
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

// Settings keys stored in database
export const SETTINGS_KEYS = {
  API_KEY: "openrouter.apiKey",
  MODEL: "openrouter.model",
  TARGET_LANG: "openrouter.targetLang",
} as const;

export interface OpenRouterSettings {
  apiKey: string | null;
  model: string | null;
  targetLang: string | null;
}

// Model definitions with capabilities
export interface ModelDefinition {
  id: string;
  name: string;
  vision?: boolean;
  expensive?: boolean;
}

// Popular models available for selection
export const POPULAR_MODELS: ModelDefinition[] = [
  // Vision models (can translate text in images)
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", vision: true },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview", vision: true, expensive: true },
  { id: "openai/gpt-5.2", name: "GPT-5.2", vision: true, expensive: true },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast", vision: true },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", vision: true, expensive: true },
  // Text-only models (notes only)
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
  { id: "mistralai/mistral-small-creative", name: "Mistral Small Creative" },
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
