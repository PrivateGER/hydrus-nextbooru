import { describe, expect, it } from "vitest";
import { toVectorLiteral, validateEmbeddingVector } from "@/lib/embeddings/vector";

describe("embedding vector helpers", () => {
  it("validates expected dimensions and finite values", () => {
    expect(validateEmbeddingVector([0.1, -0.2, 0.3], 3)).toEqual([0.1, -0.2, 0.3]);
    expect(() => validateEmbeddingVector([0.1, 0.2], 3)).toThrow(RangeError);
    expect(() => validateEmbeddingVector([0.1, Number.NaN, 0.3], 3)).toThrow(TypeError);
    expect(() => validateEmbeddingVector([0.1, Infinity, 0.3], 3)).toThrow(TypeError);
  });

  it("formats a pgvector literal", () => {
    expect(toVectorLiteral([0.1, -2, 3.5])).toBe("[0.1,-2,3.5]");
  });
});
