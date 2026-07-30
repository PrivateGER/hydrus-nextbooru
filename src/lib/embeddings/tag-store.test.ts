import { describe, it, expect } from "vitest";
import { TagCategory } from "@/generated/prisma/client";
import { tagEmbeddingText, toTagEmbeddingConfig } from "./tag-store";

describe("tagEmbeddingText", () => {
  it("turns danbooru-style underscores into readable phrases", () => {
    expect(tagEmbeddingText("looking_at_viewer", TagCategory.GENERAL)).toBe("looking at viewer");
    expect(tagEmbeddingText("on_back", TagCategory.GENERAL)).toBe("on back");
  });

  it("keeps Hydrus-style space-separated tags as-is", () => {
    expect(tagEmbeddingText("blue eyes", TagCategory.GENERAL)).toBe("blue eyes");
  });

  it("prefixes proper-noun categories so the model can ground bare names", () => {
    expect(tagEmbeddingText("some_artist", TagCategory.ARTIST)).toBe("artist: some artist");
    expect(tagEmbeddingText("hatsune miku", TagCategory.CHARACTER)).toBe("character: hatsune miku");
    expect(tagEmbeddingText("vocaloid", TagCategory.COPYRIGHT)).toBe("series: vocaloid");
  });

  it("leaves META bare and trims whitespace", () => {
    expect(tagEmbeddingText(" high resolution ", TagCategory.META)).toBe("high resolution");
  });
});

describe("toTagEmbeddingConfig", () => {
  it("drops the image resolution axis so one tag store serves every preprocessing setting", () => {
    expect(
      toTagEmbeddingConfig({
        baseUrl: "https://openrouter.ai/api/v1",
        model: "google/gemini-embedding-2-preview",
        dimensions: 768,
        imageMaxResolution: 1024,
      })
    ).toEqual({
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemini-embedding-2-preview",
      dimensions: 768,
    });
  });
});
