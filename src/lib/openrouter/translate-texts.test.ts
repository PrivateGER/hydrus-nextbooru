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

  it("attaches the page image as a multimodal user message when pageImage is set", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(completionResponse('["Hello"]'));

    const result = await client.translateTexts({
      texts: ["こんにちは"],
      sourceLangs: ["ja"],
      targetLang: "en",
      pageImage: { base64: "QUJD", mimeType: "image/jpeg" },
    });
    expect(result.translations).toEqual(["Hello"]);

    const body = JSON.parse(
      String(((global.fetch as Mock).mock.calls[0] as [string, RequestInit])[1].body)
    );
    // The user turn is a content array carrying the image plus the region JSON.
    const userContent = body.messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    const image = userContent.find((p: { type: string }) => p.type === "image_url");
    expect(image.image_url.url).toBe("data:image/jpeg;base64,QUJD");
    const text = userContent.find((p: { type: string }) => p.type === "text");
    expect(text.text).toContain("こんにちは");
    // The system prompt tells the model to use the attached page image.
    expect(body.messages[0].content).toContain("page image");
  });

  it("sends a plain text user message when no pageImage is set", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(completionResponse('["Hi"]'));
    await client.translateTexts({ texts: ["やあ"] });
    const body = JSON.parse(
      String(((global.fetch as Mock).mock.calls[0] as [string, RequestInit])[1].body)
    );
    expect(typeof body.messages[1].content).toBe("string");
  });
});
