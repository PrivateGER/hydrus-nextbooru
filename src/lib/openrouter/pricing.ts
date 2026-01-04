/**
 * OpenRouter pricing data and cost estimation utilities.
 *
 * Fetches pricing dynamically from OpenRouter's API with caching.
 */

import { getOpenRouterSettings } from "./settings";

export interface ModelPricing {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
}

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string; // Per-token price as string
    completion: string;
    request?: string;
    image?: string;
  };
}

interface ModelsResponse {
  data: OpenRouterModel[];
}

// Cache for model pricing (refreshed periodically)
let pricingCache: Map<string, ModelPricing> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Default pricing for unknown models (conservative estimate).
 */
export const DEFAULT_PRICING: ModelPricing = { input: 1.00, output: 4.00 };

/**
 * Fetch all model pricing from OpenRouter API.
 */
async function fetchModelPricing(
  apiKey: string
): Promise<Map<string, ModelPricing>> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = (await response.json()) as ModelsResponse;
  const pricing = new Map<string, ModelPricing>();

  for (const model of data.data) {
    // Pricing is per-token, convert to per-1M tokens
    const promptPerToken = parseFloat(model.pricing.prompt) || 0;
    const completionPerToken = parseFloat(model.pricing.completion) || 0;

    pricing.set(model.id, {
      input: promptPerToken * 1_000_000,
      output: completionPerToken * 1_000_000,
    });
  }

  return pricing;
}

/**
 * Get pricing for a model, fetching from API if needed.
 * Uses cached data when available.
 */
export async function getModelPricing(modelId: string): Promise<ModelPricing> {
  const now = Date.now();

  // Check if cache is valid
  if (pricingCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return pricingCache.get(modelId) ?? DEFAULT_PRICING;
  }

  // Try to refresh cache
  try {
    const settings = await getOpenRouterSettings();
    if (settings.apiKey) {
      pricingCache = await fetchModelPricing(settings.apiKey);
      cacheTimestamp = now;
      return pricingCache.get(modelId) ?? DEFAULT_PRICING;
    }
  } catch (error) {
    // Log for debugging but don't fail - fallback to cache/default
    console.debug?.("Failed to refresh pricing cache:", error);
    // If fetch fails, use cached data if available, otherwise default
    if (pricingCache) {
      return pricingCache.get(modelId) ?? DEFAULT_PRICING;
    }
  }

  return DEFAULT_PRICING;
}

/**
 * Get pricing synchronously from cache (for display purposes).
 * Returns default if not cached.
 */
export function getModelPricingSync(modelId: string): ModelPricing {
  return pricingCache?.get(modelId) ?? DEFAULT_PRICING;
}

/**
 * Pre-warm the pricing cache.
 */
export async function warmPricingCache(): Promise<void> {
  try {
    const settings = await getOpenRouterSettings();
    if (settings.apiKey) {
      pricingCache = await fetchModelPricing(settings.apiKey);
      cacheTimestamp = Date.now();
    }
  } catch (error) {
    // Log for debugging but don't fail during warmup
    console.debug?.("Failed to warm pricing cache:", error);
  }
}

/**
 * Estimate token count for a text string.
 *
 * Uses a simple heuristic:
 * - ~4 characters per token for Latin scripts
 * - ~2 characters per token for CJK (Chinese, Japanese, Korean)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count CJK characters (Chinese, Japanese, Korean)
  const cjkPattern = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/g;
  const cjkMatches = text.match(cjkPattern) || [];
  const cjkCount = cjkMatches.length;
  const nonCjkCount = text.length - cjkCount;

  // CJK: ~2 chars per token, Latin: ~4 chars per token
  return Math.ceil(nonCjkCount / 4 + cjkCount / 2);
}

/**
 * Translation system prompt token overhead.
 * This is roughly constant for all translations.
 */
export const SYSTEM_PROMPT_TOKENS = 120;

/**
 * Average output tokens per translation response.
 * Includes language detection + translated text.
 */
export const AVG_OUTPUT_TOKENS = 80;

export interface CostEstimate {
  uniqueTitles: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  model: string;
  pricing: ModelPricing;
}

/**
 * Estimate the cost of translating a list of titles.
 *
 * @param titles - Array of title strings to translate
 * @param model - Model ID to use for pricing
 * @returns Cost estimate with token counts and USD cost
 */
export async function estimateTranslationCost(
  titles: string[],
  model: string
): Promise<CostEstimate> {
  const pricing = await getModelPricing(model);

  // Calculate input tokens: system prompt + each title
  let totalTitleTokens = 0;
  for (const title of titles) {
    totalTitleTokens += estimateTokens(title);
  }

  const estimatedInputTokens =
    titles.length * SYSTEM_PROMPT_TOKENS + totalTitleTokens;
  const estimatedOutputTokens = titles.length * AVG_OUTPUT_TOKENS;

  // Cost = tokens * (price per 1M tokens) / 1,000,000
  const inputCost = (estimatedInputTokens * pricing.input) / 1_000_000;
  const outputCost = (estimatedOutputTokens * pricing.output) / 1_000_000;

  return {
    uniqueTitles: titles.length,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: inputCost + outputCost,
    model,
    pricing,
  };
}

/**
 * Format a USD cost for display.
 * Shows more precision for small amounts.
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
