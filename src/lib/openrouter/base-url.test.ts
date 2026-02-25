import { describe, it, expect } from "vitest";
import { DEFAULT_BASE_URL, normalizeBaseUrl, isCustomEndpointUrl } from "./base-url";

describe("normalizeBaseUrl", () => {
  it("should trim whitespace and trailing slashes", () => {
    expect(normalizeBaseUrl(" https://example.com/v1/ ")).toBe("https://example.com/v1");
  });
});

describe("isCustomEndpointUrl", () => {
  it("should return false when baseUrl is empty", () => {
    expect(isCustomEndpointUrl(null)).toBe(false);
    expect(isCustomEndpointUrl(undefined)).toBe(false);
    expect(isCustomEndpointUrl("")).toBe(false);
  });

  it("should return false for the default OpenRouter endpoint", () => {
    expect(isCustomEndpointUrl(DEFAULT_BASE_URL)).toBe(false);
    expect(isCustomEndpointUrl(`${DEFAULT_BASE_URL}/`)).toBe(false);
  });

  it("should return true for custom endpoints", () => {
    expect(isCustomEndpointUrl("https://example.com/v1")).toBe(true);
  });
});
