import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Only run integration tests
    include: ['src/test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],

    // Shared env setup + integration-specific setup
    setupFiles: ['./src/test/setup.ts', './src/test/integration/vitest-setup.ts'],

    // Longer timeouts for container startup
    testTimeout: 60000,
    hookTimeout: 120000,

    // Keep container-backed suites strictly single-worker in Vitest v4.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,

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
