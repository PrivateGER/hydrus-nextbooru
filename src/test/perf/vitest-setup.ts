/**
 * Vitest setup for perf test files: flush buffered benchmark results to
 * JSON after each file (each file runs in its own fork, so per-process
 * buffering and a per-file output path cannot race).
 */

import { afterAll, expect } from 'vitest';
import path from 'path';
import { flushBenchmarkResults } from './results';

afterAll(() => {
  const testPath = expect.getState().testPath ?? 'perf';
  const slug = path.basename(testPath).replace(/\.perf\.test\.ts$/, '');

  const file = flushBenchmarkResults({
    dir: process.env.PERF_RESULTS_DIR || 'perf-results',
    slug,
    datasetSize: process.env.PERF_DATASET_SIZE || 'medium',
  });

  if (file) {
    console.log(`Benchmark results written to ${file}`);
  }
});
