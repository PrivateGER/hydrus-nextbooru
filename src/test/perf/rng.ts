/**
 * Deterministic randomness for dataset seeding.
 *
 * Benchmarks are only comparable run-to-run if the dataset is identical,
 * so all seeding randomness flows through a seeded PRNG instead of
 * Math.random().
 */

/** Mulberry32: small, fast, good-enough PRNG. Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zipf-distributed index sampler over ranks [0, n).
 *
 * Real booru tag usage is power-law: a few tags appear on a large share
 * of posts while most tags sit in a long tail. Uniform sampling hides
 * exactly the co-occurrence and AND-search behavior benchmarks must
 * exercise. Uses an inverse-CDF table with binary search; s is the
 * Zipf exponent (1.0 ≈ classic).
 */
export function createZipfSampler(
  n: number,
  s: number,
  rng: () => number
): () => number {
  const cdf = new Float64Array(n);
  let acc = 0;
  for (let rank = 0; rank < n; rank++) {
    acc += 1 / Math.pow(rank + 1, s);
    cdf[rank] = acc;
  }
  const total = acc;

  return () => {
    const target = rng() * total;
    // Binary search for the first rank whose cumulative weight >= target.
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  };
}
