/**
 * Simple LRU cache with max size limit
 */

export class LRUCache<T> {
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

/**
 * LRU cache with TTL (time-to-live) support
 */
interface CachedValue<T> {
  data: T;
  timestamp: number;
}

export class TTLCache<T> {
  private cache: LRUCache<CachedValue<T>>;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.cache = new LRUCache<CachedValue<T>>(maxSize);
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttlMs) {
      return undefined;
    }

    return cached.data;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Tag name -> ID cache (max 10k tags)
export const tagIdCache = new LRUCache<number>(10_000);

// Post IDs for tag combinations (max 500 combinations)
export const postIdsCache = new LRUCache<number[]>(500);

// Tree response cache (max 200 entries, 5 minute TTL)
const TREE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export interface TreeCacheEntry {
  tags: Array<{ id: number; name: string; category: string; count: number }>;
  postCount: number;
}
export const treeResponseCache = new TTLCache<TreeCacheEntry>(200, TREE_CACHE_TTL);

// Invalidate all caches when data changes (call after sync)
export function invalidateAllCaches(): void {
  tagIdCache.clear();
  postIdsCache.clear();
  treeResponseCache.clear();
}
