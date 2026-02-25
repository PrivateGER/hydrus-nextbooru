import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterClient, OpenRouterConfigError } from "./client";

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
});
