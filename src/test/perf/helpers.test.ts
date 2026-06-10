import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertPerformance, shouldEnforcePerfThresholds, stats } from './helpers';

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
