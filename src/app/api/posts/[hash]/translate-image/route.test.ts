import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUnique,
  mockUpdatePost,
  mockReadFile,
  mockBuildFilePath,
  mockGetOpenRouterSettings,
  mockGetEffectiveModel,
  mockModelSupportsVision,
  mockGetOpenRouterClient,
  mockTranslateImage,
  mockAiLogError,
  MockOpenRouterApiError,
  MockOpenRouterConfigError,
} = vi.hoisted(() => {
  class TestOpenRouterApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  class TestOpenRouterConfigError extends Error {}

  return {
    mockFindUnique: vi.fn(),
    mockUpdatePost: vi.fn(),
    mockReadFile: vi.fn(),
    mockBuildFilePath: vi.fn(),
    mockGetOpenRouterSettings: vi.fn(),
    mockGetEffectiveModel: vi.fn(),
    mockModelSupportsVision: vi.fn(),
    mockGetOpenRouterClient: vi.fn(),
    mockTranslateImage: vi.fn(),
    mockAiLogError: vi.fn(),
    MockOpenRouterApiError: TestOpenRouterApiError,
    MockOpenRouterConfigError: TestOpenRouterConfigError,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    post: {
      findUnique: mockFindUnique,
      update: mockUpdatePost,
    },
  },
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
}));

vi.mock("@/lib/hydrus/paths", () => ({
  buildFilePath: mockBuildFilePath,
}));

vi.mock("@/lib/logger", () => ({
  aiLog: {
    error: mockAiLogError,
  },
}));

vi.mock("@/lib/openrouter", () => ({
  getOpenRouterSettings: mockGetOpenRouterSettings,
  getEffectiveModel: mockGetEffectiveModel,
  modelSupportsVision: mockModelSupportsVision,
  getOpenRouterClient: mockGetOpenRouterClient,
  OpenRouterApiError: MockOpenRouterApiError,
  OpenRouterConfigError: MockOpenRouterConfigError,
}));

const validHash = "a".repeat(64);

describe("POST /api/posts/[hash]/translate-image", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFindUnique.mockResolvedValue({
      id: 1,
      hash: validHash,
      mimeType: "image/png",
      extension: "png",
    });
    mockReadFile.mockResolvedValue(Buffer.from("image-bytes"));
    mockBuildFilePath.mockReturnValue("/tmp/test.png");
    mockGetOpenRouterSettings.mockResolvedValue({});
    mockGetEffectiveModel.mockReturnValue("google/gemini-3-flash-preview");
    mockModelSupportsVision.mockReturnValue(true);
    mockTranslateImage.mockResolvedValue({
      translatedText: "translated",
      sourceLang: "ja",
      targetLang: "en",
      hasText: true,
    });
    mockGetOpenRouterClient.mockResolvedValue({
      translateImage: mockTranslateImage,
    });
    mockUpdatePost.mockResolvedValue({});
  });

  it("returns 400 for invalid hash format", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/posts/invalid/translate-image", {
        method: "POST",
        body: JSON.stringify({ targetLang: "en" }),
      }),
      { params: Promise.resolve({ hash: "invalid" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid hash format");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when configured model does not support vision", async () => {
    mockModelSupportsVision.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest(`http://localhost/api/posts/${validHash}/translate-image`, {
        method: "POST",
      }),
      { params: Promise.resolve({ hash: validHash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("MODEL_NO_VISION");
    expect(mockGetOpenRouterClient).not.toHaveBeenCalled();
  });

  it("does not persist translation when translated image has no text", async () => {
    mockTranslateImage.mockResolvedValueOnce({
      translatedText: "",
      sourceLang: "",
      targetLang: "en",
      hasText: false,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest(`http://localhost/api/posts/${validHash}/translate-image`, {
        method: "POST",
        body: JSON.stringify({ targetLang: "en" }),
      }),
      { params: Promise.resolve({ hash: validHash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasText).toBe(false);
    expect(mockUpdatePost).not.toHaveBeenCalled();
  });

  it("maps OpenRouter API errors to status codes", async () => {
    mockTranslateImage.mockRejectedValueOnce(new MockOpenRouterApiError("Rate limited", 429));

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest(`http://localhost/api/posts/${validHash}/translate-image`, {
        method: "POST",
      }),
      { params: Promise.resolve({ hash: validHash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limited");
  });

  it("maps generic API key errors to 401", async () => {
    mockTranslateImage.mockRejectedValueOnce(new Error("API key is missing"));

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest(`http://localhost/api/posts/${validHash}/translate-image`, {
        method: "POST",
      }),
      { params: Promise.resolve({ hash: validHash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("API key");
  });
});
