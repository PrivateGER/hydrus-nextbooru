import { defineConfig } from 'vitest/config';
import path from 'path';
import { containerSuiteDefaults } from './vitest.container-suite-defaults';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

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
