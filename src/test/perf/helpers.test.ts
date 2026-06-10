import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertPerformance, assertScaling, shouldEnforcePerfThresholds, stats } from './helpers';

describe('shouldEnforcePerfThresholds', () => {
  it('enforces by default outside CI', () => {
    expect(shouldEnforcePerfThresholds({})).toBe(true);
  });

  it('reports only (no enforcement) on CI runners', () => {
    expect(shouldEnforcePerfThresholds({ CI: 'true' })).toBe(false);
    expect(shouldEnforcePerfThresholds({ CI: '1' })).toBe(false);
  });

  it('treats CI=false the same as not being in CI', () => {
    expect(shouldEnforcePerfThresholds({ CI: 'false' })).toBe(true);
  });

  it('PERF_ASSERT=true forces enforcement even in CI', () => {
    expect(shouldEnforcePerfThresholds({ CI: 'true', PERF_ASSERT: 'true' })).toBe(true);
  });

  it('PERF_ASSERT=false disables enforcement even locally', () => {
    expect(shouldEnforcePerfThresholds({ PERF_ASSERT: 'false' })).toBe(false);
  });
});

describe('assertScaling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enforces the ratio when the baseline is large enough to be meaningful', () => {
    vi.stubEnv('CI', '');
    const baseline = stats([10, 10, 10]); // p95 = 10ms
    const scaled = stats([200, 200, 200]); // 20x

    expect(() =>
      assertScaling(baseline, scaled, { maxRatio: 10, absoluteCeilingMs: 500 })
    ).toThrow(/ratio/);
  });

  it('passes when scaling stays within the ratio', () => {
    vi.stubEnv('CI', '');
    const baseline = stats([10, 10, 10]);
    const scaled = stats([50, 50, 50]); // 5x

    expect(() =>
      assertScaling(baseline, scaled, { maxRatio: 10, absoluteCeilingMs: 500 })
    ).not.toThrow();
  });

  it('falls back to an absolute ceiling for sub-5ms baselines', () => {
    vi.stubEnv('CI', '');
    const baseline = stats([1, 1, 1]); // ratio would be 60x but meaningless
    const fastScaled = stats([60, 60, 60]);
    const slowScaled = stats([600, 600, 600]);

    expect(() =>
      assertScaling(baseline, fastScaled, { maxRatio: 10, absoluteCeilingMs: 100 })
    ).not.toThrow();
    expect(() =>
      assertScaling(baseline, slowScaled, { maxRatio: 10, absoluteCeilingMs: 100 })
    ).toThrow(/ceiling/);
  });

  it('is report-only on CI', () => {
    vi.stubEnv('CI', 'true');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const baseline = stats([10, 10, 10]);
    const scaled = stats([500, 500, 500]);

    expect(() =>
      assertScaling(baseline, scaled, { maxRatio: 10, absoluteCeilingMs: 100 })
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('assertPerformance', () => {
  const slow = stats([100, 200, 300]); // p95 = 300

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('throws on exceeded threshold when enforcement is on', () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('PERF_ASSERT', '');
    expect(() => assertPerformance(slow, { p95: 50 })).toThrow(/p95/);
  });

  it('warns instead of throwing when running in CI', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('PERF_ASSERT', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => assertPerformance(slow, { p95: 50 })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/p95/));
  });

  it('still throws in CI when PERF_ASSERT=true', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('PERF_ASSERT', 'true');
    expect(() => assertPerformance(slow, { p95: 50 })).toThrow(/p95/);
  });

  it('passes silently when thresholds are met', () => {
    vi.stubEnv('CI', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => assertPerformance(slow, { p95: 1000 })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
