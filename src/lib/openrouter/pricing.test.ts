import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  estimateTokens,
  formatCost,
  getModelPricingSync,
  getModelPricing,
  warmPricingCache,
  estimateTranslationCost,
  DEFAULT_PRICING,
  SYSTEM_PROMPT_TOKENS,
  AVG_OUTPUT_TOKENS,
} from "./pricing";

describe("estimateTokens", () => {
  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("should estimate tokens for Latin text (~4 chars per token)", () => {
    // 8 chars = ~2 tokens
    expect(estimateTokens("abcdefgh")).toBe(2);
    // 12 chars = 3 tokens
    expect(estimateTokens("Hello World!")).toBe(3);
    // 100 chars = 25 tokens
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });

  it("should estimate tokens for CJK text (~2 chars per token)", () => {
    // 4 CJK chars = ~2 tokens
    expect(estimateTokens("日本語")).toBe(2); // 3 chars => ceil(3/2) = 2
    expect(estimateTokens("日本語文")).toBe(2); // 4 chars => 2 tokens
    expect(estimateTokens("日本語文字")).toBe(3); // 5 chars => ceil(5/2) = 3
  });

  it("should handle mixed Latin and CJK text", () => {
    // "Hello" (5 Latin) + "日本語" (3 CJK)
    // = ceil(5/4 + 3/2) = ceil(1.25 + 1.5) = ceil(2.75) = 3
    expect(estimateTokens("Hello日本語")).toBe(3);
  });

  it("should handle Korean characters as CJK", () => {
    // 한국어 = 3 Korean chars
    expect(estimateTokens("한국어")).toBe(2); // ceil(3/2) = 2
  });

  it("should handle fullwidth characters as CJK", () => {
    // ＡＢＣ = 3 fullwidth chars (in FF00-FFEF range)
    expect(estimateTokens("ＡＢＣ")).toBe(2); // ceil(3/2) = 2
  });
});

describe("formatCost", () => {
  it("should format $0.00 for zero", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("should show 4 decimal places for amounts < $0.01", () => {
    expect(formatCost(0.001)).toBe("$0.0010");
    expect(formatCost(0.0001)).toBe("$0.0001");
    expect(formatCost(0.00999)).toBe("$0.0100");
  });

  it("should show 3 decimal places for amounts < $1", () => {
    expect(formatCost(0.01)).toBe("$0.010");
    expect(formatCost(0.1)).toBe("$0.100");
    expect(formatCost(0.999)).toBe("$0.999");
  });

  it("should show 2 decimal places for amounts >= $1", () => {
    expect(formatCost(1.0)).toBe("$1.00");
    expect(formatCost(1.234)).toBe("$1.23");
    expect(formatCost(10.999)).toBe("$11.00");
    expect(formatCost(100.5)).toBe("$100.50");
  });
});

describe("getModelPricingSync", () => {
  it("should return default pricing when cache is not populated", () => {
    const pricing = getModelPricingSync("unknown-model");
    expect(pricing).toEqual(DEFAULT_PRICING);
  });
});

describe("getModelPricing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return default pricing when API key is not configured", async () => {
    // Mock settings to return no API key
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi.fn().mockResolvedValue({ apiKey: null }),
    }));

    // Re-import to get fresh module with mocked settings
    const { getModelPricing: getModelPricingMocked } = await import(
      "./pricing"
    );
    const pricing = await getModelPricingMocked("openai/gpt-4");
    expect(pricing).toEqual(DEFAULT_PRICING);
  });
});

describe("warmPricingCache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not throw when API key is not configured", async () => {
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi.fn().mockResolvedValue({ apiKey: null }),
    }));

    const { warmPricingCache: warmPricingCacheMocked } = await import(
      "./pricing"
    );
    await expect(warmPricingCacheMocked()).resolves.not.toThrow();
  });

  it("should not throw when fetch fails", async () => {
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi
        .fn()
        .mockResolvedValue({ apiKey: "test-key" }),
    }));

    // Mock global fetch to fail
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { warmPricingCache: warmPricingCacheMocked } = await import(
      "./pricing"
    );
    await expect(warmPricingCacheMocked()).resolves.not.toThrow();

    global.fetch = originalFetch;
  });
});

describe("estimateTranslationCost", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return zero cost for empty titles array", async () => {
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi.fn().mockResolvedValue({ apiKey: null }),
    }));

    const { estimateTranslationCost: estimateMocked } = await import(
      "./pricing"
    );
    const result = await estimateMocked([], "test-model");

    expect(result.uniqueTitles).toBe(0);
    expect(result.estimatedInputTokens).toBe(0);
    expect(result.estimatedOutputTokens).toBe(0);
    expect(result.estimatedCostUsd).toBe(0);
  });

  it("should calculate cost based on title tokens", async () => {
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi.fn().mockResolvedValue({ apiKey: null }),
    }));

    const { estimateTranslationCost: estimateMocked, DEFAULT_PRICING } =
      await import("./pricing");
    const titles = ["Hello World"]; // ~3 tokens

    const result = await estimateMocked(titles, "test-model");

    expect(result.uniqueTitles).toBe(1);
    // Input: 1 * SYSTEM_PROMPT_TOKENS (120) + title tokens (~3) = 123
    expect(result.estimatedInputTokens).toBe(SYSTEM_PROMPT_TOKENS + 3);
    // Output: 1 * AVG_OUTPUT_TOKENS (80)
    expect(result.estimatedOutputTokens).toBe(AVG_OUTPUT_TOKENS);
    expect(result.model).toBe("test-model");
    expect(result.pricing).toEqual(DEFAULT_PRICING);
  });

  it("should scale cost with number of titles", async () => {
    vi.doMock("./settings", () => ({
      getOpenRouterSettings: vi.fn().mockResolvedValue({ apiKey: null }),
    }));

    const { estimateTranslationCost: estimateMocked } = await import(
      "./pricing"
    );
    const titles = ["Title 1", "Title 2", "Title 3"];

    const result = await estimateMocked(titles, "test-model");

    expect(result.uniqueTitles).toBe(3);
    // Output should be 3 * AVG_OUTPUT_TOKENS
    expect(result.estimatedOutputTokens).toBe(3 * AVG_OUTPUT_TOKENS);
  });
});
