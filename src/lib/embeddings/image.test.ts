import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { preprocessImageBufferForEmbedding } from "@/lib/embeddings/image";

describe("embedding image preprocessing", () => {
  it("resizes images to fit the configured longest side", async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 40, g: 120, b: 220 },
      },
    })
      .png()
      .toBuffer();

    const result = await preprocessImageBufferForEmbedding(input, 64);

    expect(result.sourceWidth).toBe(200);
    expect(result.sourceHeight).toBe(100);
    expect(result.processedWidth).toBe(64);
    expect(result.processedHeight).toBe(32);
    expect(result.dataUrl.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("does not enlarge smaller images", async () => {
    const input = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessImageBufferForEmbedding(input, 128);

    expect(result.processedWidth).toBe(32);
    expect(result.processedHeight).toBe(24);
  });
});
