import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterClient, OpenRouterApiError, OpenRouterConfigError } from "./client";

const createResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? "OK" : "Bad Request",
  json: vi.fn().mockResolvedValue(body),
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe("OpenRouterClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should require API key for OpenRouter default base URL", () => {
    expect(() => new OpenRouterClient({ apiKey: "" })).toThrow(OpenRouterConfigError);
  });

  it("should allow empty API key for custom base URL", () => {
    expect(
      () => new OpenRouterClient({ apiKey: "", baseUrl: "https://example.com/v1" })
    ).not.toThrow();
  });

  it("should normalize Responses API output_text to chat completion shape", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({ output_text: "Hello" })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const result = await client.chatCompletion({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.choices[0]?.message?.content).toBe("Hello");
  });

  it("should extract text from Responses output array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        output: [
          {
            content: [{ type: "output_text", text: "Array text" }],
          },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const result = await client.chatCompletion({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.choices[0]?.message?.content).toBe("Array text");
  });

  it("should parse models from LM Studio-style responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        models: [
          { key: "openai/gpt-oss-20b", display_name: "GPT-OSS 20B" },
          { id: "custom-model", name: "Custom Model" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
      { id: "custom-model", name: "Custom Model" },
    ]);
  });

  it("should parse models from OpenRouter-style data responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        data: [
          { id: "provider/model-a", name: "Model A" },
          { id: "provider/model-b" },
          { name: "Missing Id" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "provider/model-a", name: "Model A" },
      { id: "provider/model-b", name: "provider/model-b" },
    ]);
  });

  it("should parse models from array-root responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse([
        { id: "array/model-a", display_name: "Array Model A" },
        { key: "array/model-b" },
      ])
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "array/model-a", name: "Array Model A" },
      { id: "array/model-b", name: "array/model-b" },
    ]);
  });

  it("should throw OpenRouterApiError when model listing fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({ error: "rate limited" }, false, 429)
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    await expect(client.listModels()).rejects.toBeInstanceOf(OpenRouterApiError);
  });
});
