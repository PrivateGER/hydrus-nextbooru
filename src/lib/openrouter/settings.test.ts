import { describe, it, expect } from "vitest";
import {
  getEffectiveModel,
  isCustomEndpoint,
  OpenRouterConfigError,
  validateBaseUrlFormat,
  InvalidBaseUrlError,
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

describe("validateBaseUrlFormat", () => {
  it("accepts remote http(s) endpoints", () => {
    expect(validateBaseUrlFormat("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1"
    );
    expect(validateBaseUrlFormat("http://api.example.com:8080/v1")).toBe(
      "http://api.example.com:8080/v1"
    );
  });

  it("trims surrounding whitespace and returns the trimmed URL", () => {
    expect(validateBaseUrlFormat("  https://example.com/v1  ")).toBe(
      "https://example.com/v1"
    );
  });

  it("accepts loopback, LAN, and tailnet addresses (no SSRF filtering)", () => {
    expect(validateBaseUrlFormat("http://127.0.0.1:11434/v1")).toBe(
      "http://127.0.0.1:11434/v1"
    );
    expect(validateBaseUrlFormat("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1"
    );
    expect(validateBaseUrlFormat("http://[::1]:11434/v1")).toBe(
      "http://[::1]:11434/v1"
    );
    expect(validateBaseUrlFormat("http://192.168.1.10:11434/v1")).toBe(
      "http://192.168.1.10:11434/v1"
    );
    expect(validateBaseUrlFormat("http://10.1.2.3/v1")).toBe(
      "http://10.1.2.3/v1"
    );
    // Tailscale CGNAT range (100.64.0.0/10)
    expect(validateBaseUrlFormat("http://100.88.200.21:11434/v1")).toBe(
      "http://100.88.200.21:11434/v1"
    );
    expect(validateBaseUrlFormat("http://169.254.169.254/")).toBe(
      "http://169.254.169.254/"
    );
  });

  it("rejects malformed / non-absolute URLs", () => {
    expect(() => validateBaseUrlFormat("not a url")).toThrow(
      InvalidBaseUrlError
    );
    expect(() => validateBaseUrlFormat("/relative/path")).toThrow(
      InvalidBaseUrlError
    );
    expect(() => validateBaseUrlFormat("")).toThrow(InvalidBaseUrlError);
  });

  it("rejects URLs with embedded credentials (fetch cannot use them)", () => {
    expect(() =>
      validateBaseUrlFormat("https://user:pass@example.com/v1")
    ).toThrow(InvalidBaseUrlError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => validateBaseUrlFormat("file:///etc/passwd")).toThrow(
      InvalidBaseUrlError
    );
    expect(() => validateBaseUrlFormat("javascript:alert(1)")).toThrow(
      InvalidBaseUrlError
    );
    expect(() => validateBaseUrlFormat("ftp://example.com/v1")).toThrow(
      InvalidBaseUrlError
    );
  });
});
