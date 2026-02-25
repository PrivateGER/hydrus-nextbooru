import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

describe("GET /api/admin/models", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return status from OpenRouterApiError", async () => {
    vi.doMock("@/lib/openrouter", () => {
      class OpenRouterApiError extends Error {
        statusCode: number;
        constructor(message: string, statusCode: number) {
          super(message);
          this.statusCode = statusCode;
        }
      }

      return {
      getTranslationSettings: vi.fn().mockResolvedValue({
        provider: "local",
        targetLang: "en",
        openrouter: { apiKey: null, model: null, baseUrl: null },
        local: { apiKey: "", model: "local-model", baseUrl: "https://example.com/v1" },
      }),
      OpenRouterApiError,
      OpenRouterClient: class {
        listModels() {
          throw new OpenRouterApiError("Nope", 418);
        }
      },
      };
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(418);
    const data = await response.json();
    expect(data.error).toBe("Nope");
  });

  it("should return 500 on unexpected errors", async () => {
    vi.doMock("@/lib/openrouter", () => ({
      getTranslationSettings: vi.fn().mockResolvedValue({
        provider: "local",
        targetLang: "en",
        openrouter: { apiKey: null, model: null, baseUrl: null },
        local: { apiKey: "", model: "local-model", baseUrl: "https://example.com/v1" },
      }),
      OpenRouterApiError: class extends Error {},
      OpenRouterClient: class {
        listModels() {
          throw new Error("Boom");
        }
      },
    }));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to fetch models");
  });
});
