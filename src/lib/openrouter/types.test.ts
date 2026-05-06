import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  POPULAR_EMBEDDING_MODELS,
  POPULAR_MODELS,
  modelSupportsVision,
} from "@/lib/openrouter/types";

describe("OpenRouter model suggestions", () => {
  it("keeps the default chat model in the vision-capable suggestion list", () => {
    const defaultSuggestion = POPULAR_MODELS.find((model) => model.id === DEFAULT_CHAT_MODEL);

    expect(defaultSuggestion).toBeDefined();
    expect(defaultSuggestion?.vision).toBe(true);
    expect(modelSupportsVision(DEFAULT_CHAT_MODEL)).toBe(true);
  });

  it("marks text-only suggestions so image translation rejects them", () => {
    const textOnlySuggestions = POPULAR_MODELS.filter((model) => !model.vision);

    expect(textOnlySuggestions.map((model) => model.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
    ]);

    for (const model of textOnlySuggestions) {
      expect(modelSupportsVision(model.id)).toBe(false);
    }
  });

  it("only suggests embedding models that match the indexed multimodal search defaults", () => {
    expect(POPULAR_EMBEDDING_MODELS).toEqual([
      {
        id: DEFAULT_EMBEDDING_MODEL,
        name: "Gemini Embedding 2 Preview",
        vision: true,
        dimensions: [768, 1536, 3072],
      },
    ]);
  });
});
