import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Only run perf tests
    include: ['src/test/perf/**/*.perf.test.ts'],
    exclude: ['node_modules', '.next'],

    // Shared env setup + integration setup (Testcontainers)
    setupFiles: ['./src/test/setup.ts', './src/test/integration/vitest-setup.ts'],

    // Longer timeouts for perf tests with large datasets
    testTimeout: 600000,  // 10min per test
    hookTimeout: 600000,  // 10min for beforeAll (seeding)

    // Keep container-backed suites strictly single-worker in Vitest v4.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,

    // Verbose output to see timing results
    reporters: ['verbose'],

    // Disable coverage for perf tests
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
