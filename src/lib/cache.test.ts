import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LRUCache, TTLCache, invalidateAllCaches, tagIdsByNameCache } from "./cache";

describe("LRUCache", () => {
  it("evicts the least recently used entry when capacity is exceeded", () => {
    const cache = new LRUCache<number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("replaces an existing key without making room by evicting another entry", () => {
    const cache = new LRUCache<number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBe(2);
  });
});

describe("TTLCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached values before the TTL and removes them after expiry", () => {
    const cache = new TTLCache<string>(2, 1_000);

    cache.set("a", "fresh");
    vi.advanceTimersByTime(1_000);
    expect(cache.get("a")).toBe("fresh");

    vi.advanceTimersByTime(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("a")).toBeUndefined();
  });

  it("still applies the underlying LRU capacity", () => {
    const cache = new TTLCache<number>(1, 10_000);

    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
  });
});

describe("invalidateAllCaches", () => {
  it("clears exported shared caches used by backend query routes", () => {
    tagIdsByNameCache.set("artist", [1, 2]);

    invalidateAllCaches();

    expect(tagIdsByNameCache.get("artist")).toBeUndefined();
  });
});
