import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION,
  DEFAULT_EMBEDDING_MODEL,
  SETTINGS_KEYS,
} from "@/lib/openrouter/types";
import {
  getEmbeddingOpenRouterSettings,
  getEmbeddingSettings,
  isEmbeddingApiKeyRequired,
  isEmbeddingProviderConfigured,
  isSupportedEmbeddingDimensions,
  isSupportedEmbeddingResolution,
  normalizeEmbeddingBaseUrl,
  toEmbeddingConfig,
  updateEmbeddingSettings,
} from "./settings";

const { mockSettingsFindMany, mockMaskApiKey, mockUpdateSettings } = vi.hoisted(() => ({
  mockSettingsFindMany: vi.fn(),
  mockMaskApiKey: vi.fn(),
  mockUpdateSettings: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: {
      findMany: mockSettingsFindMany,
    },
  },
}));

vi.mock("@/lib/openrouter/settings", () => ({
  maskApiKey: mockMaskApiKey,
  updateSettings: mockUpdateSettings,
}));

describe("embedding settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsFindMany.mockResolvedValue([]);
    mockMaskApiKey.mockImplementation((key: string) => `masked:${key.slice(-4)}`);
    mockUpdateSettings.mockResolvedValue(undefined);
  });

  it("validates supported embedding dimensions and image resolutions", () => {
    expect(isSupportedEmbeddingDimensions(1536)).toBe(true);
    expect(isSupportedEmbeddingDimensions(1024)).toBe(false);
    expect(isSupportedEmbeddingResolution(1024)).toBe(true);
    expect(isSupportedEmbeddingResolution(999)).toBe(false);
  });

  it("normalizes endpoints and derives provider configured state", () => {
    expect(normalizeEmbeddingBaseUrl(null)).toBe("https://openrouter.ai/api/v1");
    expect(normalizeEmbeddingBaseUrl(" https://local.example/v1/ ")).toBe(
      "https://local.example/v1"
    );
    expect(isEmbeddingApiKeyRequired("https://openrouter.ai/api/v1")).toBe(true);
    expect(isEmbeddingApiKeyRequired("https://local.example/v1")).toBe(false);
    expect(isEmbeddingProviderConfigured({ apiKey: null, baseUrl: "https://openrouter.ai/api/v1" })).toBe(
      false
    );
    expect(isEmbeddingProviderConfigured({ apiKey: "secret", baseUrl: "https://openrouter.ai/api/v1" })).toBe(
      true
    );
    expect(isEmbeddingProviderConfigured({ apiKey: null, baseUrl: "https://local.example/v1" })).toBe(
      true
    );
    expect(
      toEmbeddingConfig({
        baseUrl: " https://local.example/v1/ ",
        model: "embedding-model",
        dimensions: 768,
        imageMaxResolution: 512,
      })
    ).toEqual({
      baseUrl: "https://local.example/v1",
      model: "embedding-model",
      dimensions: 768,
      imageMaxResolution: 512,
    });
  });

  it("loads settings with masked API key and safe fallbacks for invalid numeric values", async () => {
    mockSettingsFindMany.mockResolvedValueOnce([
      { key: SETTINGS_KEYS.API_KEY, value: "or-secret-key" },
      { key: SETTINGS_KEYS.BASE_URL, value: " http://localhost:1234/v1/ " },
      { key: SETTINGS_KEYS.EMBEDDING_MODEL, value: "custom-embedding-model" },
      { key: SETTINGS_KEYS.EMBEDDING_DIMENSIONS, value: "999" },
      { key: SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION, value: "not-a-number" },
    ]);

    await expect(getEmbeddingSettings()).resolves.toEqual({
      apiKey: "or-secret-key",
      apiKeyConfigured: true,
      apiKeyRequired: false,
      maskedApiKey: "masked:-key",
      baseUrl: "http://localhost:1234/v1",
      model: "custom-embedding-model",
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      imageMaxResolution: DEFAULT_EMBEDDING_IMAGE_MAX_RESOLUTION,
    });
    expect(mockMaskApiKey).toHaveBeenCalledWith("or-secret-key");
  });

  it("returns OpenRouter-compatible embedding settings with null target language", async () => {
    mockSettingsFindMany.mockResolvedValueOnce([
      { key: SETTINGS_KEYS.EMBEDDING_DIMENSIONS, value: "768" },
      { key: SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION, value: "2048" },
    ]);

    await expect(getEmbeddingOpenRouterSettings()).resolves.toEqual({
      apiKey: null,
      baseUrl: "https://openrouter.ai/api/v1",
      model: DEFAULT_EMBEDDING_MODEL,
      targetLang: null,
      dimensions: 768,
      imageMaxResolution: 2048,
    });
  });

  it("trims and persists only meaningful update fields", async () => {
    await updateEmbeddingSettings({
      apiKey: "  secret-key  ",
      baseUrl: " https://local.example/v1/ ",
      model: "  embedding-model  ",
      dimensions: 3072,
      imageMaxResolution: 1536,
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      [SETTINGS_KEYS.API_KEY]: "secret-key",
      [SETTINGS_KEYS.BASE_URL]: "https://local.example/v1",
      [SETTINGS_KEYS.EMBEDDING_MODEL]: "embedding-model",
      [SETTINGS_KEYS.EMBEDDING_DIMENSIONS]: "3072",
      [SETTINGS_KEYS.EMBEDDING_IMAGE_MAX_RESOLUTION]: "1536",
    });
  });

  it("rejects invalid update fields before writing settings", async () => {
    await expect(updateEmbeddingSettings({ model: "  " })).rejects.toThrow(
      "Embedding model is required"
    );
    await expect(updateEmbeddingSettings({ dimensions: 42 })).rejects.toThrow(
      "Embedding dimensions must be one of: 768, 1536, 3072"
    );
    await expect(updateEmbeddingSettings({ imageMaxResolution: 42 })).rejects.toThrow(
      "Image resolution must be one of: 512, 768, 1024, 1536, 2048"
    );
    await expect(updateEmbeddingSettings({ baseUrl: `https://example.com/${"a".repeat(2048)}` })).rejects.toThrow(
      "Embedding base URL must be 2048 characters or fewer"
    );
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
