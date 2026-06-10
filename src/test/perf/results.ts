/**
 * Machine-readable benchmark output.
 *
 * Timing results are buffered per process (each perf test file runs in its
 * own fork) and flushed to `<dir>/<slug>.json` in github-action-benchmark's
 * `customSmallerIsBetter` format. CI merges the per-file outputs and feeds
 * them to the trend tracker; locally the files are simply inspectable.
 */

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Stats } from './helpers';

export interface BenchmarkRecord {
  name: string;
  stats: Stats;
}

/** Entry shape required by github-action-benchmark's custom tools. */
export interface BenchmarkJsonEntry {
  name: string;
  unit: string;
  value: number;
  extra?: string;
}

let records: BenchmarkRecord[] = [];

export function recordBenchmark(name: string, stats: Stats): void {
  records.push({ name, stats });
}

export function resetBenchmarkRecords(): void {
  records = [];
}

/**
 * Convert records to customSmallerIsBetter entries. p50 tracks typical
 * latency, p95 tracks tail latency; both are charted independently.
 */
export function toBenchmarkJson(
  benchmarks: BenchmarkRecord[],
  meta: { datasetSize: string }
): BenchmarkJsonEntry[] {
  return benchmarks.flatMap(({ name, stats }) => {
    const extra = `${stats.count} iterations; dataset=${meta.datasetSize}`;
    return [
      { name: `${name} (p50)`, unit: 'ms', value: stats.p50, extra },
      { name: `${name} (p95)`, unit: 'ms', value: stats.p95, extra },
    ];
  });
}

/**
 * Write buffered records to `<dir>/<slug>.json` and clear the buffer.
 * Returns the file path, or null when nothing was recorded.
 */
export function flushBenchmarkResults(options: {
  dir: string;
  slug: string;
  datasetSize: string;
}): string | null {
  if (records.length === 0) {
    return null;
  }

  const entries = toBenchmarkJson(records, { datasetSize: options.datasetSize });
  records = [];

  mkdirSync(options.dir, { recursive: true });
  const filePath = path.join(options.dir, `${options.slug}.json`);
  writeFileSync(filePath, JSON.stringify(entries, null, 2));
  return filePath;
}
