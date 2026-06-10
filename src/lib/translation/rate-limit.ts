import type { ApiRateLimitConfig } from "@/lib/rate-limit";

/**
 * Relaxed rate limit shared across all translation endpoints (notes, group titles, image OCR).
 *
 * Translations call paid LLM APIs, but the product decision is to keep them public and generous
 * (most boorus pre-generate translations). The limit is intentionally looser than the
 * search route (60/min) so normal browsing never trips it, while still capping runaway abuse
 * of the paid API budget. A shared key caps a single client's total translation spend.
 */
export const TRANSLATE_RATE_LIMIT_CONFIG = {
  prefix: "translate",
  limit: 120,
  windowMs: 60 * 1000,
} satisfies ApiRateLimitConfig;
