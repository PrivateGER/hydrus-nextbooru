import { http, HttpResponse, type RequestHandler } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import type { ChatCompletionResponse } from '@/lib/openrouter/types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const DEFAULT_MODELS_URL = 'https://example.com/v1/models';

/**
 * State for the mock OpenRouter server.
 * Tests can modify this to control server responses.
 */
export interface MockOpenRouterState {
  translationResponse?: string;
  sourceLang?: string;
  error?: { message: string; status: number };
  delayMs?: number;
  models?: { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }[];
  modelsError?: { message: string; status: number };
  modelsUrl?: string;
  /** Set to true to simulate OpenRouter returning empty/malformed translation */
  emptyTranslation?: boolean;
  /** Override the finish_reason in the response (e.g. "content_filter") */
  finishReason?: "stop" | "length" | "content_filter" | "error" | "tool_calls";
  /** Tracks the number of API calls made */
  callCount: number;
}

export function createMockOpenRouterState(): MockOpenRouterState {
  return {
    translationResponse: 'This is a mock translation',
    sourceLang: 'Japanese',
    models: [
      { id: 'custom-model-1', name: 'Custom Model 1' },
      { id: 'custom-model-2', name: 'Custom Model 2' },
    ],
    callCount: 0,
  };
}

/**
 * Create a mock chat completion response for translation
 */
function createTranslationResponse(state: MockOpenRouterState): ChatCompletionResponse {
  const sourceLang = state.sourceLang || 'Japanese';
  const translation = state.translationResponse || 'Mock translation';

  // Simulate empty/malformed response from OpenRouter
  let content: string;
  if (state.emptyTranslation) {
    content = `LANGUAGE: ${sourceLang}\nTRANSLATION:\n`;
  } else {
    content = `LANGUAGE: ${sourceLang}\nTRANSLATION:\n${translation}`;
  }

  return {
    id: 'mock-completion-id',
    model: 'google/gemini-2.5-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: state.finishReason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

/**
 * Create a mock chat completion response for image translation
 */
function createImageTranslationResponse(
  state: MockOpenRouterState,
  hasText = true
): ChatCompletionResponse {
  const content = hasText
    ? `LANGUAGE: ${state.sourceLang || 'Japanese'}\nTRANSLATION:\n${state.translationResponse || 'Mock image translation'}`
    : 'NO_TEXT';

  return {
    id: 'mock-completion-id',
    model: 'google/gemini-2.5-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: state.finishReason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

/**
 * Create MSW handlers for OpenRouter API endpoints.
 */
export function createOpenRouterHandlers(state: MockOpenRouterState): RequestHandler[] {
  const handleModelsRequest = async () => {
    if (state.modelsError) {
      return HttpResponse.json(
        { error: { message: state.modelsError.message } },
        { status: state.modelsError.status }
      );
    }

    state.callCount++;

    const modelsWithPricing = (state.models ?? []).map((model) => ({
      ...model,
      pricing: {
        prompt: model.pricing?.prompt ?? "0.000001",
        completion: model.pricing?.completion ?? "0.000002",
      },
    }));

    return HttpResponse.json({
      data: modelsWithPricing,
      models: modelsWithPricing,
    });
  };

  return [
    http.get(state.modelsUrl ?? DEFAULT_MODELS_URL, handleModelsRequest),
    http.get(OPENROUTER_MODELS_URL, handleModelsRequest),
    http.post(OPENROUTER_URL, async ({ request }) => {
      if (state.delayMs) {
        await new Promise((r) => setTimeout(r, state.delayMs));
      }

      if (state.error) {
        return HttpResponse.json(
          { error: { message: state.error.message } },
          { status: state.error.status }
        );
      }

      // Parse request with proper type safety
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return HttpResponse.json(
          { error: { message: 'Invalid JSON' } },
          { status: 400 }
        );
      }

      // Validate request structure
      if (!body || typeof body !== 'object' || !('messages' in body) || !Array.isArray((body as { messages: unknown }).messages)) {
        return HttpResponse.json(
          { error: { message: 'Invalid request: messages array required' } },
          { status: 400 }
        );
      }

      const messages = (body as { messages: Array<{ role?: string; content?: unknown }> }).messages;
      const userMessage = messages.find((m) => m.role === 'user');

      // Increment call count for successful requests
      state.callCount++;

      // Check if it's an image translation (content is an array with image_url)
      const isImageTranslation = Array.isArray(userMessage?.content);

      if (isImageTranslation) {
        return HttpResponse.json(createImageTranslationResponse(state));
      }

      return HttpResponse.json(createTranslationResponse(state));
    }),
  ];
}

/**
 * Create a mock OpenRouter server for testing.
 */
export function createMockOpenRouterServer(state: MockOpenRouterState): SetupServer {
  return setupServer(...createOpenRouterHandlers(state));
}

/**
 * Helper to configure specific translation responses
 */
export function setTranslationResponse(
  state: MockOpenRouterState,
  translation: string,
  sourceLang = 'Japanese'
): void {
  state.translationResponse = translation;
  state.sourceLang = sourceLang;
}

/**
 * Helper to configure error responses
 */
export function setOpenRouterError(
  state: MockOpenRouterState,
  message: string,
  status = 500
): void {
  state.error = { message, status };
}

/**
 * Helper to clear error state
 */
export function clearOpenRouterError(state: MockOpenRouterState): void {
  state.error = undefined;
}

/**
 * Helper to simulate empty translation response
 */
export function setEmptyTranslation(state: MockOpenRouterState, empty = true): void {
  state.emptyTranslation = empty;
}

/**
 * Helper to reset the API call count
 */
export function resetCallCount(state: MockOpenRouterState): void {
  state.callCount = 0;
}
