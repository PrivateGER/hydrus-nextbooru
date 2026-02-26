import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockQueryRaw,
  mockUpsert,
  mockTranslate,
  mockGetOpenRouterClient,
  mockLogInfo,
  mockLogError,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockUpsert: vi.fn(),
  mockTranslate: vi.fn(),
  mockGetOpenRouterClient: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    contentTranslation: {
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  aiLog: {
    info: mockLogInfo,
    error: mockLogError,
  },
}));

vi.mock("@/lib/openrouter", () => {
  class OpenRouterApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  class OpenRouterConfigError extends Error {}

  return {
    getOpenRouterClient: mockGetOpenRouterClient,
    OpenRouterApiError,
    OpenRouterConfigError,
  };
});

import {
  batchTranslateNotes,
} from "./notes-translation";
import {
  OpenRouterApiError,
  OpenRouterConfigError,
} from "@/lib/openrouter";

describe("batchTranslateNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenRouterClient.mockResolvedValue({
      translate: mockTranslate,
    });
  });

  it("translates each unique note content and upserts translations", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "shared content" },
      { contentHash: "b".repeat(64), content: "other content" },
    ]);

    mockTranslate
      .mockResolvedValueOnce({
        translatedText: "shared translated",
        sourceLang: "ja",
        targetLang: "en",
      })
      .mockResolvedValueOnce({
        translatedText: "other translated",
        sourceLang: "ja",
        targetLang: "en",
      });

    const result = await batchTranslateNotes({ targetLang: "en", batchDelayMs: 0 });

    expect(result).toEqual({
      status: "completed",
      total: 2,
      completed: 2,
      failed: 0,
      errors: [],
    });
    expect(mockTranslate).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("returns immediately when no note IDs are provided in scoped mode", async () => {
    const result = await batchTranslateNotes({ noteIds: [] });

    expect(result.total).toBe(0);
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockGetOpenRouterClient).not.toHaveBeenCalled();
  });

  it("ignores invalid scoped note IDs and exits when none are valid", async () => {
    const result = await batchTranslateNotes({ noteIds: [0, -3, Number.NaN] });

    expect(result.total).toBe(0);
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockGetOpenRouterClient).not.toHaveBeenCalled();
  });

  it("returns completed with zero work when no untranslated notes are found", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await batchTranslateNotes();

    expect(result).toEqual({
      status: "completed",
      total: 0,
      completed: 0,
      failed: 0,
      errors: [],
    });
    expect(mockGetOpenRouterClient).not.toHaveBeenCalled();
  });

  it("returns error status when authentication fails during translation", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
    ]);
    mockTranslate.mockRejectedValue(new OpenRouterApiError("Unauthorized", 401));

    const result = await batchTranslateNotes({ batchDelayMs: 0 });

    expect(result.status).toBe("error");
    expect(result.failed).toBe(1);
    expect(result.errors.some((error) => error.includes("Authentication failed"))).toBe(true);
  });

  it("replaces overflow error entries with auth error when maxErrors is reached", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
      { contentHash: "b".repeat(64), content: "content B" },
    ]);
    mockTranslate
      .mockRejectedValueOnce(new Error("some failure"))
      .mockRejectedValueOnce(new OpenRouterApiError("Unauthorized", 401));

    const result = await batchTranslateNotes({ batchDelayMs: 0, maxErrors: 1 });

    expect(result.status).toBe("error");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Authentication failed");
  });

  it("returns error status when client configuration is invalid", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
    ]);
    mockGetOpenRouterClient.mockRejectedValue(
      new OpenRouterConfigError("OpenRouter API key not configured")
    );

    const result = await batchTranslateNotes();

    expect(result.status).toBe("error");
    expect(result.errors[0]).toContain("OpenRouter API key not configured");
  });

  it("returns API-prefixed errors for OpenRouter API failures outside translation loop", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
    ]);
    mockGetOpenRouterClient.mockRejectedValue(new OpenRouterApiError("Rate limited", 429));

    const result = await batchTranslateNotes();

    expect(result.status).toBe("error");
    expect(result.errors[0]).toContain("API error: Rate limited");
  });

  it("returns unknown-error message for non-Error failures", async () => {
    mockQueryRaw.mockRejectedValue("database unavailable");

    const result = await batchTranslateNotes();

    expect(result.status).toBe("error");
    expect(result.errors[0]).toContain("Unknown error");
  });

  it("clamps maxConcurrent to avoid stalled batch loops", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
    ]);
    mockTranslate.mockResolvedValue({
      translatedText: "translated A",
      sourceLang: "ja",
      targetLang: "en",
    });

    const result = await batchTranslateNotes({ maxConcurrent: 0, batchDelayMs: 0 });

    expect(result.status).toBe("completed");
    expect(result.completed).toBe(1);
    expect(mockTranslate).toHaveBeenCalledTimes(1);
  });

  it("returns cancelled when cancellation is requested before a batch runs", async () => {
    mockQueryRaw.mockResolvedValue([
      { contentHash: "a".repeat(64), content: "content A" },
    ]);

    const result = await batchTranslateNotes({
      isCancelled: () => true,
      batchDelayMs: 0,
    });

    expect(result.status).toBe("cancelled");
    expect(result.total).toBe(1);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});
