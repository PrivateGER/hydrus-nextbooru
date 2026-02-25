import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockGetTranslationSettings,
  mockUpdateSettings,
  mockMaskApiKey,
  mockApiLogError,
  settingsKeys,
  MockOpenRouterClient,
} = vi.hoisted(() => {
  class TestOpenRouterClient {
    static getDefaultBaseUrl(): string {
      return "https://openrouter.ai/api/v1";
    }

    static getDefaultTargetLang(): string {
      return "en";
    }

    static getSupportedLanguages(): { code: string; name: string }[] {
      return [{ code: "en", name: "English" }];
    }

    static getDefaultModel(): string {
      return "google/gemini-3-flash-preview";
    }
  }

  return {
    mockVerifyAdminSession: vi.fn(),
    mockGetTranslationSettings: vi.fn(),
    mockUpdateSettings: vi.fn(),
    mockMaskApiKey: vi.fn(),
    mockApiLogError: vi.fn(),
    settingsKeys: {
      PROVIDER: "translation_provider",
      TARGET_LANG: "translation_target_lang",
      API_KEY: "openrouter_api_key",
      MODEL: "openrouter_model",
      BASE_URL: "openrouter_base_url",
      LOCAL_API_KEY: "local_api_key",
      LOCAL_MODEL: "local_model",
      LOCAL_BASE_URL: "local_base_url",
    },
    MockOpenRouterClient: TestOpenRouterClient,
  };
});

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: {
    error: mockApiLogError,
  },
}));

vi.mock("@/lib/openrouter", () => ({
  getTranslationSettings: mockGetTranslationSettings,
  updateSettings: mockUpdateSettings,
  maskApiKey: mockMaskApiKey,
  SETTINGS_KEYS: settingsKeys,
  OpenRouterClient: MockOpenRouterClient,
}));

function createSettings() {
  return {
    provider: "openrouter" as const,
    targetLang: "ja",
    openrouter: {
      apiKey: "or-secret-key",
      model: "google/gemini-3-flash-preview",
      baseUrl: "https://openrouter.ai/api/v1",
    },
    local: {
      apiKey: "local-secret-key",
      model: "local-model",
      baseUrl: "http://localhost:1234/v1",
    },
  };
}

describe("Admin settings route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockMaskApiKey.mockImplementation((key: string) => `***${key.slice(-4)}`);
    mockGetTranslationSettings.mockResolvedValue(createSettings());
  });

  it("returns auth response when GET is unauthorized", async () => {
    mockVerifyAdminSession.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns masked settings and defaults on GET", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.provider).toBe("openrouter");
    expect(data.supportedLanguages).toEqual([{ code: "en", name: "English" }]);
    expect(data.openrouter.apiKey).toBe("***-key");
    expect(data.local.apiKey).toBe("***-key");
    expect(data.openrouter.model).toBe("google/gemini-3-flash-preview");
  });

  it("returns 500 when GET settings retrieval fails", async () => {
    mockGetTranslationSettings.mockRejectedValueOnce(new Error("db unavailable"));

    const { GET } = await import("./route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to get settings");
  });

  it("returns 400 when PUT has no updatable fields", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({}),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No settings to update");
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("updates provider/openrouter/local settings and returns masked payload", async () => {
    mockGetTranslationSettings.mockResolvedValueOnce({
      provider: "local",
      targetLang: "en",
      openrouter: {
        apiKey: "new-openrouter-key",
        model: "google/gemini-3-flash-preview",
        baseUrl: "https://openrouter.ai/api/v1",
      },
      local: {
        apiKey: "new-local-key",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: "local",
          targetLang: "en",
          openrouter: {
            apiKey: "new-openrouter-key",
            model: "google/gemini-3-flash-preview",
            baseUrl: "https://openrouter.ai/api/v1",
          },
          local: {
            apiKey: "new-local-key",
            model: "qwen2.5",
            baseUrl: "http://localhost:11434/v1",
          },
        }),
      })
    );
    const data = await response.json();

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      [settingsKeys.PROVIDER]: "local",
      [settingsKeys.TARGET_LANG]: "en",
      [settingsKeys.API_KEY]: "new-openrouter-key",
      [settingsKeys.MODEL]: "google/gemini-3-flash-preview",
      [settingsKeys.BASE_URL]: "https://openrouter.ai/api/v1",
      [settingsKeys.LOCAL_API_KEY]: "new-local-key",
      [settingsKeys.LOCAL_MODEL]: "qwen2.5",
      [settingsKeys.LOCAL_BASE_URL]: "http://localhost:11434/v1",
    });
    expect(response.status).toBe(200);
    expect(data.message).toBe("Settings updated successfully");
    expect(data.provider).toBe("local");
  });

  it("returns 500 when PUT body parsing fails", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "PUT",
        body: "{",
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update settings");
  });
});
