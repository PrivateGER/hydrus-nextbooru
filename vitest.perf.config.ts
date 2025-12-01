import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    // Only run perf tests
    include: ['src/test/perf/**/*.perf.test.ts'],
    exclude: ['node_modules', '.next'],

    // Use integration setup (Testcontainers)
    setupFiles: ['./src/test/integration/vitest-setup.ts'],

    // Longer timeouts for perf tests with large datasets
    testTimeout: 600000,  // 10min per test
    hookTimeout: 600000,  // 10min for beforeAll (seeding)

    // Single thread for shared database connection
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Verbose output to see timing results
    reporters: ['verbose'],

    // Disable coverage for perf tests
    coverage: {
      enabled: false,
    },
  },
}));
