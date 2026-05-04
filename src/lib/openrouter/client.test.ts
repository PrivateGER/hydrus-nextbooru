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

  it("should use chat/completions with messages for local-compatible endpoints", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        id: "cmpl-local",
        model: "local-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
          },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    await client.chatCompletion({
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 111,
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(url).toBe("https://example.com/v1/chat/completions");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.input).toBeUndefined();
    expect(body.max_tokens).toBe(111);
  });

  it("should use chat/completions with messages for OpenRouter endpoints", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        id: "cmpl-or",
        model: "openrouter-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
          },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
    });

    await client.chatCompletion({
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 222,
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.input).toBeUndefined();
    expect(body.max_tokens).toBe(222);
  });

  it("should create text embeddings through the embeddings endpoint", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        model: "google/gemini-embedding-2-preview",
        data: [
          {
            object: "embedding",
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        usage: { prompt_tokens: 3, total_tokens: 3 },
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
      model: "google/gemini-embedding-2-preview",
    });

    const result = await client.createEmbedding({
      input: "blue sky",
      dimensions: 3,
      input_type: "search_query",
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(url).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(body).toMatchObject({
      model: "google/gemini-embedding-2-preview",
      input: "blue sky",
      dimensions: 3,
      encoding_format: "float",
      input_type: "search_query",
    });
    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("should create image embeddings with multimodal image input", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        model: "google/gemini-embedding-2-preview",
        data: [{ object: "embedding", embedding: [1, 0, 0], index: 0 }],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
      model: "google/gemini-embedding-2-preview",
    });

    await client.createImageEmbedding({
      imageUrl: "data:image/webp;base64,abc",
      dimensions: 3,
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body.input).toEqual([
      {
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/webp;base64,abc" },
          },
        ],
      },
    ]);
  });

  it("should create multiple image embeddings in one multimodal request", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        model: "google/gemini-embedding-2-preview",
        data: [
          { object: "embedding", embedding: [1, 0, 0], index: 0 },
          { object: "embedding", embedding: [0, 1, 0], index: 1 },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
      model: "google/gemini-embedding-2-preview",
    });

    const results = await client.createImageEmbeddings({
      imageUrls: ["data:image/webp;base64,abc", "data:image/webp;base64,def"],
      dimensions: 3,
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.input).toEqual([
      {
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/webp;base64,abc" },
          },
        ],
      },
      {
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/webp;base64,def" },
          },
        ],
      },
    ]);
    expect(results.map((result) => result.embedding)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
  });

  it("should reject malformed embedding responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        model: "bad-model",
        data: [{ object: "embedding", embedding: "base64", index: 0 }],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
    });

    await expect(client.createEmbedding({ input: "test" })).rejects.toThrow(OpenRouterApiError);
  });

  it("should reject embedding responses missing a requested index", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        model: "bad-model",
        data: [{ object: "embedding", embedding: [1, 0, 0], index: 1 }],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "or-key",
      baseUrl: OpenRouterClient.getDefaultBaseUrl(),
    });

    await expect(client.createEmbeddings({ input: ["first", "second"] })).rejects.toThrow(OpenRouterApiError);
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
      { id: "custom-model", name: "Custom Model" },
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
    ]);
  });

  it("should parse OpenAI-style data lists and filter non-generation LM Studio models", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        object: "list",
        data: [
          { id: "qwen/qwen3.5-35b-a3b", object: "model", owned_by: "organization_owner" },
          { id: "text-embedding-nomic-embed-text-v1.5", object: "model", owned_by: "organization_owner" },
          { id: "gpt-oss-safeguard-20b", object: "model", owned_by: "organization_owner" },
          { id: "openai/gpt-oss-120b", object: "model", owned_by: "organization_owner" },
          { id: "qwen/qwen3.5-35b-a3b", object: "model", owned_by: "organization_owner" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "openai/gpt-oss-120b", name: "openai/gpt-oss-120b" },
      { id: "qwen/qwen3.5-35b-a3b", name: "qwen/qwen3.5-35b-a3b" },
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

  it("should keep non-generation models when no generation model is available", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        data: [
          { id: "text-embedding-nomic-embed-text-v1.5" },
          { id: "jina-embeddings-v3" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "jina-embeddings-v3", name: "jina-embeddings-v3" },
      { id: "text-embedding-nomic-embed-text-v1.5", name: "text-embedding-nomic-embed-text-v1.5" },
    ]);
  });

  it("should merge duplicate models to preserve richer names", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        data: [
          { id: "provider/model-a" },
          { id: "provider/model-a", display_name: "Provider Model A" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "provider/model-a", name: "Provider Model A" },
    ]);
  });

  it("should not filter generation models based only on display name text", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        data: [
          { id: "provider/model-a", name: "Model A Embeddings Edition" },
          { id: "provider/model-b", name: "Model B" },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const models = await client.listModels();

    expect(models).toEqual([
      { id: "provider/model-a", name: "Model A Embeddings Edition" },
      { id: "provider/model-b", name: "Model B" },
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

  it("should throw OpenRouterApiError when finish_reason is content_filter", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        id: "cmpl-filtered",
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "" },
            finish_reason: "content_filter",
          },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const filterErr = await client.chatCompletion({
      messages: [{ role: "user", content: "translate this" }],
    }).catch((e: unknown) => e);

    expect(filterErr).toBeInstanceOf(OpenRouterApiError);
    expect((filterErr as OpenRouterApiError).statusCode).toBe(451);
    expect((filterErr as OpenRouterApiError).message).toContain("content filter");
  });

  it("should throw OpenRouterApiError when finish_reason is error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        id: "cmpl-error",
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "upstream provider failed" },
            finish_reason: "error",
          },
        ],
      })
    );

    const client = new OpenRouterClient({
      apiKey: "",
      baseUrl: "https://example.com/v1",
    });

    const modelErr = await client.chatCompletion({
      messages: [{ role: "user", content: "translate this" }],
    }).catch((e: unknown) => e);

    expect(modelErr).toBeInstanceOf(OpenRouterApiError);
    expect((modelErr as OpenRouterApiError).statusCode).toBe(502);
    expect((modelErr as OpenRouterApiError).message).toBe("Model returned an error");
  });

  it("should not throw when finish_reason is stop", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createResponse({
        id: "cmpl-ok",
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
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

    expect(result.choices[0].finish_reason).toBe("stop");
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
