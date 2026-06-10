import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Unit suite only; integration/perf/guards run via dedicated configs.
    // Pure helper tests in src/test/guards (*.test.ts) still run here.
    exclude: ['node_modules', '.next', 'src/test/perf/**/*.perf.test.ts', 'src/test/integration/**', 'src/test/guards/**/*.guard.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['src/generated/**', 'src/test/**'],
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
