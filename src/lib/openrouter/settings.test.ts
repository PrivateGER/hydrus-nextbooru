import { describe, it, expect } from "vitest";
import {
  getEffectiveModel,
  isCustomEndpoint,
  OpenRouterConfigError,
} from "@/lib/openrouter";
import { OpenRouterClient } from "@/lib/openrouter/client";

describe("isCustomEndpoint", () => {
  it("should return false when baseUrl is empty", () => {
    expect(isCustomEndpoint(null)).toBe(false);
    expect(isCustomEndpoint(undefined)).toBe(false);
    expect(isCustomEndpoint("")).toBe(false);
  });

  it("should return false for the default OpenRouter endpoint", () => {
    expect(isCustomEndpoint("https://openrouter.ai/api/v1")).toBe(false);
    expect(isCustomEndpoint("https://openrouter.ai/api/v1/")).toBe(false);
  });

  it("should return true for custom endpoints", () => {
    expect(isCustomEndpoint("https://example.com/v1")).toBe(true);
  });
});

describe("getEffectiveModel", () => {
  it("should return default model for OpenRouter with no model configured", () => {
    const model = getEffectiveModel({
      apiKey: "test-key",
      model: null,
      targetLang: null,
      baseUrl: null,
    });

    expect(model).toBe(OpenRouterClient.getDefaultModel());
  });

  it("should return configured model for custom endpoints", () => {
    const model = getEffectiveModel({
      apiKey: "test-key",
      model: "custom-model",
      targetLang: null,
      baseUrl: "https://example.com/v1",
    });

    expect(model).toBe("custom-model");
  });

  it("should throw when custom endpoint is missing a model", () => {
    expect(() =>
      getEffectiveModel({
        apiKey: "test-key",
        model: null,
        targetLang: null,
        baseUrl: "https://example.com/v1",
      })
    ).toThrow(OpenRouterConfigError);
  });
});
