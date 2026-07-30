import { describe, it, expect } from "vitest";
import {
  aggregateTagScore,
  blendSemanticScore,
  orderByBlendedScore,
  TAG_RERANK_BLEND_WEIGHT,
} from "./tag-rerank";

// Same prod-measured anchor as calibration.test.ts: random pairs p90 ~0.75.
const BASELINE = 0.75;

describe("aggregateTagScore", () => {
  it("returns 0 when the post has no tag matches", () => {
    expect(aggregateTagScore([], BASELINE)).toBe(0);
  });

  it("returns 0 when every tag similarity sits at or below the random-pair baseline", () => {
    expect(aggregateTagScore([0.75, 0.6, 0.4], BASELINE)).toBe(0);
  });

  it("weights a single strong match by the fixed denominator, not the match count", () => {
    // One perfect tag ("on_back" for a pose query) with no other matches:
    // weight 1 out of mass 1.75 — strong, but not the same as three perfect tags.
    const single = aggregateTagScore([1], BASELINE);
    expect(single).toBeCloseTo(1 / 1.75, 5);

    const triple = aggregateTagScore([1, 1, 1], BASELINE);
    expect(triple).toBeCloseTo(1, 5);
    expect(triple).toBeGreaterThan(single);
  });

  it("keeps unrelated extra tags from dragging a strong match down", () => {
    // Calibration clamps sub-baseline sims to 0 BEFORE averaging, so forty
    // irrelevant tags cost a strong match nothing.
    const strongAlone = aggregateTagScore([0.95], BASELINE);
    const strongWithNoise = aggregateTagScore([0.95, 0.6, 0.5, 0.4, 0.3], BASELINE);
    expect(strongWithNoise).toBeCloseTo(strongAlone, 10);
  });

  it("uses only the top matches, preferring the strongest", () => {
    // Sims arrive unsorted from SQL grouping; order must not matter.
    const unsorted = aggregateTagScore([0.8, 0.99, 0.9], BASELINE);
    const sorted = aggregateTagScore([0.99, 0.9, 0.8], BASELINE);
    expect(unsorted).toBeCloseTo(sorted, 10);

    // A fourth match below the top three contributes nothing.
    expect(aggregateTagScore([0.99, 0.9, 0.8, 0.78], BASELINE)).toBeCloseTo(sorted, 10);
  });
});

describe("blendSemanticScore", () => {
  it("blends the calibrated image score with the tag score at the configured split", () => {
    const blended = blendSemanticScore(1, 1, BASELINE);
    expect(blended).toBeCloseTo(1, 5);

    const imageOnly = blendSemanticScore(1, 0, BASELINE);
    expect(imageOnly).toBeCloseTo(1 - TAG_RERANK_BLEND_WEIGHT, 5);
  });

  it("is monotone in the image score when tag scores are equal", () => {
    expect(blendSemanticScore(0.95, 0.5, BASELINE)).toBeGreaterThan(
      blendSemanticScore(0.85, 0.5, BASELINE)
    );
  });
});

describe("orderByBlendedScore", () => {
  const posts = [
    { id: 1, score: 0.92 },
    { id: 2, score: 0.9 },
    { id: 3, score: 0.88 },
  ];

  it("is the identity permutation when no post has a tag score", () => {
    expect(orderByBlendedScore(posts, new Map(), BASELINE).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("promotes a strong tag match over a slightly better image score", () => {
    // Post 3's tags nail the query ("on_back" for a pose search) while
    // posts 1-2 only look vaguely similar — post 3 must win the head.
    const tagScores = new Map([[3, 0.9]]);
    expect(orderByBlendedScore(posts, tagScores, BASELINE).map((p) => p.id)).toEqual([3, 1, 2]);
  });

  it("does not let a marginal tag score overcome a clear image-score lead", () => {
    const tagScores = new Map([[3, 0.05]]);
    expect(orderByBlendedScore(posts, tagScores, BASELINE).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("breaks exact ties by the incoming distance order", () => {
    const tied = [
      { id: 10, score: 0.9 },
      { id: 11, score: 0.9 },
    ];
    expect(orderByBlendedScore(tied, new Map(), BASELINE).map((p) => p.id)).toEqual([10, 11]);
  });

  it("does not mutate its input", () => {
    const input = [...posts];
    orderByBlendedScore(input, new Map([[3, 1]]), BASELINE);
    expect(input.map((p) => p.id)).toEqual([1, 2, 3]);
  });
});
