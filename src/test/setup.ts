import { beforeAll, afterEach, vi } from 'vitest';

// Set test environment variables
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.HYDRUS_API_URL = 'http://localhost:45869';
  process.env.HYDRUS_API_KEY = 'test-api-key';
  process.env.HYDRUS_FILES_PATH = '/test/files';
});

afterEach(() => {
  vi.clearAllMocks();
});
