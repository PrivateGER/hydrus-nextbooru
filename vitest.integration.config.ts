import { defineConfig } from 'vitest/config';
import path from 'path';
import { containerSuiteDefaults } from './vitest.container-suite-defaults';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Integration tests verify route behavior, not rate limiting (which has
    // dedicated unit tests). Without this, suites stay under per-IP budgets
    // only because the forks pool gives each file a fresh in-memory limiter.
    env: { DISABLE_RATE_LIMITS: 'true' },

    // Only run integration tests
    include: ['src/test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],

    // Longer timeouts for container startup
    testTimeout: 60000,
    hookTimeout: 120000,

    // Shared defaults for container-backed suites.
    ...containerSuiteDefaults,

    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
