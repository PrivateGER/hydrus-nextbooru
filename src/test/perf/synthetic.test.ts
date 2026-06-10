import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { unitVector, randomPhash, noteContent } from './synthetic';

describe('unitVector', () => {
  it('produces a vector of the requested dimension with unit length', () => {
    const v = unitVector(768, createRng(1));
    expect(v).toHaveLength(768);
    const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it('is deterministic for a fixed seed', () => {
    expect(unitVector(8, createRng(2))).toEqual(unitVector(8, createRng(2)));
  });

  it('contains both positive and negative components (centered distribution)', () => {
    const v = unitVector(256, createRng(3));
    expect(v.some((x) => x > 0)).toBe(true);
    expect(v.some((x) => x < 0)).toBe(true);
  });
});

describe('randomPhash', () => {
  it('produces a 64-bit value representable as a signed bigint', () => {
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) {
      const p = randomPhash(rng);
      expect(typeof p).toBe('bigint');
      // Must fit Postgres BIGINT (signed 64-bit).
      expect(p >= -(2n ** 63n)).toBe(true);
      expect(p < 2n ** 63n).toBe(true);
    }
  });

  it('is deterministic for a fixed seed', () => {
    expect(randomPhash(createRng(5))).toEqual(randomPhash(createRng(5)));
  });

  it('spreads bits (not all zero / all one)', () => {
    const p = randomPhash(createRng(6));
    expect(p).not.toBe(0n);
    expect(p).not.toBe(-1n);
  });
});

describe('noteContent', () => {
  it('produces multi-word text of roughly the requested length', () => {
    const text = noteContent(createRng(7), 20);
    const words = text.split(/\s+/);
    expect(words).toHaveLength(20);
    expect(words.every((w) => w.length > 0)).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    expect(noteContent(createRng(8), 12)).toEqual(noteContent(createRng(8), 12));
  });

  it('draws from a vocabulary larger than a handful of words', () => {
    const text = noteContent(createRng(9), 200);
    const unique = new Set(text.split(/\s+/));
    expect(unique.size).toBeGreaterThan(20);
  });
});
