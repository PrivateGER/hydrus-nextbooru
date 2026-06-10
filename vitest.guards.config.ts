import { defineConfig } from 'vitest/config';
import path from 'path';
import { containerSuiteDefaults } from './vitest.container-suite-defaults';

/**
 * Performance guard suite: deterministic, CI-stable checks (query plans,
 * query-count budgets) that replace wall-clock assertions on shared runners.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Guards assert query plans and counts; a 429 short-circuit would make
    // capture come back empty and fail the suite for the wrong reason.
    env: { DISABLE_RATE_LIMITS: 'true' },

    include: ['src/test/guards/**/*.guard.test.ts'],
    exclude: ['node_modules', '.next'],

    // Container startup + dataset seeding happen in beforeAll.
    testTimeout: 60000,
    hookTimeout: 300000,

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
