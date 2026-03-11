export const containerSuiteDefaults = {
  setupFiles: ['./src/test/setup.ts', './src/test/integration/vitest-setup.ts'],
  pool: 'forks' as const,
  fileParallelism: true
};
