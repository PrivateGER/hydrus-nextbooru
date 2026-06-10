/**
 * Performance test helpers for timing and statistics
 */

import { recordBenchmark } from './results';

export interface Stats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

/**
 * Calculate a specific percentile from an array of numbers
 */
export function percentile(times: number[], p: number): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Calculate statistics for an array of timing measurements
 */
export function stats(times: number[]): Stats {
  if (times.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
  }

  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / times.length,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    count: times.length,
  };
}

/**
 * Format stats for console output
 */
export function formatStats(s: Stats): Record<string, string> {
  return {
    min: `${s.min.toFixed(2)}ms`,
    avg: `${s.avg.toFixed(2)}ms`,
    p50: `${s.p50.toFixed(2)}ms`,
    p95: `${s.p95.toFixed(2)}ms`,
    p99: `${s.p99.toFixed(2)}ms`,
    max: `${s.max.toFixed(2)}ms`,
    count: `${s.count} iterations`,
  };
}

/**
 * Measure execution time of an async function
 */
export async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

/**
 * Run a function multiple times and collect timing measurements
 */
export async function benchmark(
  fn: () => Promise<void>,
  options: { iterations?: number; warmup?: number } = {}
): Promise<number[]> {
  const { iterations = 100, warmup = 10 } = options;

  // Warmup runs (not measured)
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Measured runs
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const { ms } = await measure(fn);
    times.push(ms);
  }

  return times;
}

/**
 * Run benchmark and return stats with formatted output.
 * Results are also buffered for machine-readable output (see results.ts).
 */
export async function benchmarkWithStats(
  name: string,
  fn: () => Promise<void>,
  options: { iterations?: number; warmup?: number } = {}
): Promise<Stats> {
  const times = await benchmark(fn, options);
  const s = stats(times);

  console.log(`\n${name}:`);
  console.table(formatStats(s));

  recordBenchmark(name, s);

  return s;
}

/**
 * Decide whether wall-clock thresholds should fail the run.
 *
 * Shared CI runners have timing variance larger than the regressions we
 * care about, so thresholds are report-only there; deterministic checks
 * (the guard suite) carry the CI signal instead. Locally thresholds stay
 * enforced. PERF_ASSERT=true/false overrides in either direction.
 */
export function shouldEnforcePerfThresholds(
  env: { CI?: string; PERF_ASSERT?: string } = process.env
): boolean {
  if (env.PERF_ASSERT === 'true') return true;
  if (env.PERF_ASSERT === 'false') return false;
  return !env.CI || env.CI === 'false';
}

/**
 * Assert that a scaled measurement stays within a ratio of its baseline.
 *
 * Ratios over sub-5ms baselines are dominated by fixed overhead and
 * measurement noise rather than algorithmic scaling, so below that floor
 * the check falls back to an absolute ceiling on the scaled measurement.
 * Throws locally; logs a warning on CI (see shouldEnforcePerfThresholds).
 */
export function assertScaling(
  baseline: Stats,
  scaled: Stats,
  { maxRatio, absoluteCeilingMs }: { maxRatio: number; absoluteCeilingMs: number }
): void {
  const MEANINGFUL_BASELINE_MS = 5;
  let violation: string | null = null;

  if (baseline.p95 >= MEANINGFUL_BASELINE_MS) {
    const ratio = scaled.p95 / baseline.p95;
    if (ratio > maxRatio) {
      violation = `scaling ratio ${ratio.toFixed(2)}x exceeded ${maxRatio}x (baseline p95 ${baseline.p95.toFixed(2)}ms, scaled p95 ${scaled.p95.toFixed(2)}ms)`;
    }
  } else if (scaled.p95 > absoluteCeilingMs) {
    violation = `scaled p95 (${scaled.p95.toFixed(2)}ms) exceeded absolute ceiling (${absoluteCeilingMs}ms; baseline too fast to ratio against)`;
  }

  if (violation === null) return;

  if (shouldEnforcePerfThresholds()) {
    throw new Error(violation);
  }
  console.warn(`[perf threshold exceeded — report only] ${violation}`);
}

/**
 * Assert that percentiles are below thresholds.
 * Throws locally; logs a warning on CI (see shouldEnforcePerfThresholds).
 */
export function assertPerformance(
  s: Stats,
  thresholds: { p50?: number; p95?: number; p99?: number }
): void {
  const violations: string[] = [];
  for (const key of ['p50', 'p95', 'p99'] as const) {
    const limit = thresholds[key];
    if (limit !== undefined && s[key] > limit) {
      violations.push(`${key} (${s[key].toFixed(2)}ms) exceeded threshold (${limit}ms)`);
    }
  }

  if (violations.length === 0) return;

  if (shouldEnforcePerfThresholds()) {
    throw new Error(violations.join('; '));
  }
  console.warn(`[perf threshold exceeded — report only] ${violations.join('; ')}`);
}
