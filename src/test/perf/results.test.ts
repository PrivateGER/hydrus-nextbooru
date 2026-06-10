import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { stats } from './helpers';
import {
  recordBenchmark,
  resetBenchmarkRecords,
  toBenchmarkJson,
  flushBenchmarkResults,
} from './results';

describe('toBenchmarkJson', () => {
  it('emits customSmallerIsBetter entries for p50 and p95 of each record', () => {
    const s = stats([10, 20, 30, 40]);
    const json = toBenchmarkJson([{ name: 'Single tag search', stats: s }], {
      datasetSize: 'medium',
    });

    expect(json).toEqual([
      {
        name: 'Single tag search (p50)',
        unit: 'ms',
        value: s.p50,
        extra: `${s.count} iterations; dataset=medium`,
      },
      {
        name: 'Single tag search (p95)',
        unit: 'ms',
        value: s.p95,
        extra: `${s.count} iterations; dataset=medium`,
      },
    ]);
  });

  it('returns an empty array for no records', () => {
    expect(toBenchmarkJson([], { datasetSize: 'small' })).toEqual([]);
  });
});

describe('recordBenchmark / flushBenchmarkResults', () => {
  let dir: string;

  beforeEach(() => {
    resetBenchmarkRecords();
    dir = mkdtempSync(path.join(tmpdir(), 'perf-results-'));
  });

  afterEach(() => {
    resetBenchmarkRecords();
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes recorded benchmarks as a JSON array and resets the buffer', () => {
    recordBenchmark('Co-occurrence search', stats([5, 6, 7]));

    const file = flushBenchmarkResults({ dir, slug: 'tag-search', datasetSize: 'large' });

    expect(file).toBe(path.join(dir, 'tag-search.json'));
    const parsed = JSON.parse(readFileSync(file!, 'utf8'));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Co-occurrence search (p50)');
    expect(parsed[0].extra).toContain('dataset=large');

    // Buffer reset: a second flush has nothing to write.
    expect(flushBenchmarkResults({ dir, slug: 'tag-search', datasetSize: 'large' })).toBeNull();
  });

  it('writes nothing when no benchmarks were recorded', () => {
    const file = flushBenchmarkResults({ dir, slug: 'empty', datasetSize: 'medium' });
    expect(file).toBeNull();
    expect(existsSync(path.join(dir, 'empty.json'))).toBe(false);
  });

  it('creates the output directory if missing', () => {
    recordBenchmark('x', stats([1]));
    const nested = path.join(dir, 'a', 'b');

    const file = flushBenchmarkResults({ dir: nested, slug: 'x', datasetSize: 'small' });

    expect(file).toBe(path.join(nested, 'x.json'));
    expect(existsSync(file!)).toBe(true);
  });
});
