import { describe, it, expect } from "vitest";
import { calibrateEmbeddingScore } from "./calibration";

// Prod-measured anchor points for gemini-embedding-2 @3072d: random pairs
// p50 0.66 / p90 ~0.75, top-20 neighbors 0.81–0.99.
const BASELINE = 0.75;

describe("calibrateEmbeddingScore", () => {
  it("maps the baseline to 0 and a perfect match to 1", () => {
    expect(calibrateEmbeddingScore(BASELINE, BASELINE)).toBe(0);
    expect(calibrateEmbeddingScore(1, BASELINE)).toBe(1);
  });

  it("clamps below-baseline (unrelated) similarities to 0 instead of going negative", () => {
    // Random pairs measured as low as 0.47 raw.
    expect(calibrateEmbeddingScore(0.47, BASELINE)).toBe(0);
    expect(calibrateEmbeddingScore(0, BASELINE)).toBe(0);
  });

  it("restores discriminative range across the observed neighbor band", () => {
    const weakest = calibrateEmbeddingScore(0.81, BASELINE);
    const median = calibrateEmbeddingScore(0.88, BASELINE);
    const nearDup = calibrateEmbeddingScore(0.99, BASELINE);
    // Raw band 0.81..0.99 is a 1.22x spread; calibrated it must widen to ~4x.
    expect(weakest).toBeCloseTo(0.24, 2);
    expect(median).toBeCloseTo(0.52, 2);
    expect(nearDup).toBeCloseTo(0.96, 2);
    expect(nearDup / weakest).toBeGreaterThan(3);
  });

  it("is the identity (clamped to [0,1]) when no baseline is available", () => {
    expect(calibrateEmbeddingScore(0.66, 0)).toBe(0.66);
    expect(calibrateEmbeddingScore(1.2, 0)).toBe(1);
    expect(calibrateEmbeddingScore(-0.1, 0)).toBe(0);
  });

  it("stays well-conditioned for a degenerate near-1 baseline", () => {
    // A baseline above the 0.95 ceiling is clamped, so the divisor never
    // approaches 0 and scores stay in [0, 1].
    const score = calibrateEmbeddingScore(0.97, 0.999);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
