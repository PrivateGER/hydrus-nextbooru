import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    // Only run integration tests
    include: ['src/test/integration/**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],

    // Use integration-specific setup
    setupFiles: ['./src/test/integration/vitest-setup.ts'],

    // Longer timeouts for container startup
    testTimeout: 60000,  // 60s per test
    hookTimeout: 120000, // 2min for beforeAll/afterAll (container startup)

    // Single thread required for shared database connection
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Disable coverage for integration tests (run separately)
    coverage: {
      enabled: false,
    },
  },
}));
