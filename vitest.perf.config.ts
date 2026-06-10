import { defineConfig } from 'vitest/config';
import path from 'path';
import { containerSuiteDefaults } from './vitest.container-suite-defaults';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Only run perf tests
    include: ['src/test/perf/**/*.perf.test.ts'],
    exclude: ['node_modules', '.next'],

    // Longer timeouts for perf tests with large datasets
    testTimeout: 600000,  // 10min per test
    hookTimeout: 600000,  // 10min for beforeAll (seeding)

    // Shared defaults for container-backed suites.
    ...containerSuiteDefaults,

    // Flush machine-readable benchmark results after each perf file.
    setupFiles: [...containerSuiteDefaults.setupFiles, './src/test/perf/vitest-setup.ts'],

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
