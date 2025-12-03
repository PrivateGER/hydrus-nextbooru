/**
 * Vitest setup file for integration tests.
 * This runs before each test file.
 */

import { afterEach } from 'vitest';
import { invalidateAllCaches } from '@/lib/cache';
import { clearPatternCache } from '@/lib/tag-blacklist';

// Clear caches after each test to ensure isolation
afterEach(() => {
  invalidateAllCaches();
  clearPatternCache();
});
