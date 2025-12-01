/**
 * Performance test helpers for timing and statistics
 */

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
 * Run benchmark and return stats with formatted output
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

  return s;
}

/**
 * Assert that a percentile is below a threshold
 */
export function assertPerformance(
  s: Stats,
  thresholds: { p50?: number; p95?: number; p99?: number }
): void {
  if (thresholds.p50 !== undefined && s.p50 > thresholds.p50) {
    throw new Error(`p50 (${s.p50.toFixed(2)}ms) exceeded threshold (${thresholds.p50}ms)`);
  }
  if (thresholds.p95 !== undefined && s.p95 > thresholds.p95) {
    throw new Error(`p95 (${s.p95.toFixed(2)}ms) exceeded threshold (${thresholds.p95}ms)`);
  }
  if (thresholds.p99 !== undefined && s.p99 > thresholds.p99) {
    throw new Error(`p99 (${s.p99.toFixed(2)}ms) exceeded threshold (${thresholds.p99}ms)`);
  }
}
