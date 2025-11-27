/**
 * Simple LRU cache with max size limit
 */

class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    // Delete first to reset position if exists
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Tag name -> ID cache (max 10k tags)
export const tagIdCache = new LRUCache<number>(10_000);

// Post IDs for tag combinations (max 500 combinations)
export const postIdsCache = new LRUCache<number[]>(500);

// Invalidate caches when data changes (call after sync)
export function invalidateSearchCaches(): void {
  tagIdCache.clear();
  postIdsCache.clear();
}
