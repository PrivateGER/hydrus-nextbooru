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
