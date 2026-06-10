import { describe, it, expect } from 'vitest';
import { createRng, createZipfSampler } from './rng';

describe('createRng', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds yield different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 10 }, () => a())).not.toEqual(
      Array.from({ length: 10 }, () => b())
    );
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('createZipfSampler', () => {
  it('only returns indexes within [0, n)', () => {
    const sample = createZipfSampler(10, 1.0, createRng(3));
    for (let i = 0; i < 1000; i++) {
      const idx = sample();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(10);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });

  it('samples low ranks far more often than high ranks (power law)', () => {
    const sample = createZipfSampler(1000, 1.0, createRng(11));
    const counts = new Array(1000).fill(0);
    for (let i = 0; i < 50_000; i++) {
      counts[sample()]++;
    }

    // Rank 0 should dominate; the tail should still be reachable.
    expect(counts[0]).toBeGreaterThan(counts[100] * 5);
    const tailHits = counts.slice(500).reduce((a, b) => a + b, 0);
    expect(tailHits).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed', () => {
    const a = createZipfSampler(50, 1.0, createRng(5));
    const b = createZipfSampler(50, 1.0, createRng(5));
    expect(Array.from({ length: 30 }, () => a())).toEqual(
      Array.from({ length: 30 }, () => b())
    );
  });

  it('handles n=1 by always returning 0', () => {
    const sample = createZipfSampler(1, 1.0, createRng(9));
    expect(sample()).toBe(0);
    expect(sample()).toBe(0);
  });
});
