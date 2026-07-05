import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { OpenRouterClient } from "./client";

const completionResponse = (content: string) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: vi.fn().mockResolvedValue({
    id: "cmpl",
    model: "m",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  }),
  text: vi.fn().mockResolvedValue(""),
});

const errorResponse = (status: number) => ({
  ok: false,
  status,
  statusText: status === 401 ? "Unauthorized" : "Server Error",
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue("error body"),
});

describe("OpenRouterClient.translateTexts", () => {
  const originalFetch = global.fetch;
  let client: OpenRouterClient;

  beforeEach(() => {
    global.fetch = vi.fn();
    client = new OpenRouterClient({ apiKey: "", baseUrl: "https://example.com/v1" });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty result without any API call for empty input", async () => {
    const result = await client.translateTexts({ texts: [] });
    expect(result).toEqual({ translations: [], targetLang: "en" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("translates all texts in one completion and parses a plain JSON array", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      completionResponse('["Hello","Goodbye"]')
    );
    const result = await client.translateTexts({
      texts: ["\u3053\u3093\u306b\u3061\u306f", "\u3055\u3088\u306a\u3089"],
      sourceLangs: ["ja", "ja"],
      targetLang: "en",
    });
    expect(result.translations).toEqual(["Hello", "Goodbye"]);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      String(((global.fetch as Mock).mock.calls[0] as [string, RequestInit])[1].body)
    );
    // All source texts travel in the single user message.
    expect(body.messages[1].content).toContain("\u3053\u3093\u306b\u3061\u306f");
    expect(body.messages[1].content).toContain("\u3055\u3088\u306a\u3089");
  });

  it("strips markdown fences before parsing", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      completionResponse('```json\n["Hi"]\n```')
    );
    const result = await client.translateTexts({ texts: ["\u3084\u3042"] });
    expect(result.translations).toEqual(["Hi"]);
  });

  it("retries once with a corrective message when the array length mismatches", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(completionResponse('["only one"]'))
      .mockResolvedValueOnce(completionResponse('["one","two"]'));

    const result = await client.translateTexts({ texts: ["a", "b"] });
    expect(result.translations).toEqual(["one", "two"]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to per-text translate() when batch parsing fails twice", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(completionResponse("not json"))
      .mockResolvedValueOnce(completionResponse("still not json"))
      // per-text fallback uses translate() -> LANGUAGE/TRANSLATION format
      .mockResolvedValueOnce(completionResponse("LANGUAGE: Japanese\nTRANSLATION:\nOne"))
      .mockResolvedValueOnce(completionResponse("LANGUAGE: Japanese\nTRANSLATION:\nTwo"));

    const result = await client.translateTexts({ texts: ["a", "b"] });
    expect(result.translations).toEqual(["One", "Two"]);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it("rejects non-string entries in the parsed array via retry/fallback path", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(completionResponse('["ok", 42]'))
      .mockResolvedValueOnce(completionResponse('["ok","fine"]'));
    const result = await client.translateTexts({ texts: ["a", "b"] });
    expect(result.translations).toEqual(["ok", "fine"]);
  });

  it("rethrows a 401 batch error without attempting per-text fallback", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(errorResponse(401));
    await expect(client.translateTexts({ texts: ["a", "b"] })).rejects.toThrow();
    // No fallback calls: the batch request is the only fetch.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to per-text calls when the batch request fails with a non-401 error", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(completionResponse("LANGUAGE: Japanese\nTRANSLATION:\nOne"))
      .mockResolvedValueOnce(completionResponse("LANGUAGE: Japanese\nTRANSLATION:\nTwo"));
    const result = await client.translateTexts({ texts: ["a", "b"] });
    expect(result.translations).toEqual(["One", "Two"]);
    // 1 failed batch attempt + 2 per-text fallback calls.
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("preserves successful per-text translations when one individual call fails", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(completionResponse("not json"))
      .mockResolvedValueOnce(completionResponse("still not json"))
      .mockResolvedValueOnce(completionResponse("LANGUAGE: Japanese\nTRANSLATION:\nOne"))
      .mockResolvedValueOnce(errorResponse(500));
    const result = await client.translateTexts({ texts: ["a", "b"] });
    expect(result.translations).toEqual(["One", null]);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
