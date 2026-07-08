import { describe, it, expect } from "vitest";
import {
  clampPage,
  parsePageParam,
  readerHref,
  resolvePageAction,
  stepPage,
  preloadTargets,
  nextFitMode,
  progressKey,
  serializeProgress,
  deserializeProgress,
} from "./reader";

describe("clampPage", () => {
  it("clamps into [1, total]", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-5, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(5, 10)).toBe(5);
  });

  it("returns 1 for an empty group", () => {
    expect(clampPage(3, 0)).toBe(1);
  });
});

describe("parsePageParam", () => {
  it("parses plain positive integers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("42")).toBe(42);
  });

  it("rejects non-integers and zero", () => {
    expect(parsePageParam("0")).toBeNull();
    expect(parsePageParam("-1")).toBeNull();
    expect(parsePageParam("1.5")).toBeNull();
    expect(parsePageParam("abc")).toBeNull();
    expect(parsePageParam("1abc")).toBeNull();
    expect(parsePageParam("")).toBeNull();
  });
});

describe("readerHref", () => {
  it("builds the canonical route", () => {
    expect(readerHref(7, 3)).toBe("/groups/7/read/3");
  });
});

describe("resolvePageAction", () => {
  it("maps left/right in LTR mode", () => {
    expect(resolvePageAction("left", false)).toBe("prev");
    expect(resolvePageAction("right", false)).toBe("next");
  });

  it("swaps sides in RTL (manga) mode", () => {
    expect(resolvePageAction("left", true)).toBe("next");
    expect(resolvePageAction("right", true)).toBe("prev");
  });
});

describe("stepPage", () => {
  it("advances and retreats within bounds", () => {
    expect(stepPage(3, 10, "next")).toBe(4);
    expect(stepPage(3, 10, "prev")).toBe(2);
  });

  it("stops at the ends", () => {
    expect(stepPage(10, 10, "next")).toBe(10);
    expect(stepPage(1, 10, "prev")).toBe(1);
  });
});

describe("preloadTargets", () => {
  it("preloads ahead first, then behind", () => {
    expect(preloadTargets(5, 10)).toEqual([6, 7, 4]);
  });

  it("respects group bounds", () => {
    expect(preloadTargets(1, 10)).toEqual([2, 3]);
    expect(preloadTargets(10, 10)).toEqual([9]);
    expect(preloadTargets(1, 1)).toEqual([]);
  });

  it("honors custom window sizes", () => {
    expect(preloadTargets(5, 10, 1, 0)).toEqual([6]);
  });
});

describe("nextFitMode", () => {
  it("cycles contain -> width -> original -> contain", () => {
    expect(nextFitMode("contain")).toBe("width");
    expect(nextFitMode("width")).toBe("original");
    expect(nextFitMode("original")).toBe("contain");
  });
});

describe("progress serialization", () => {
  it("round-trips valid progress", () => {
    const raw = serializeProgress({ page: 7, total: 20, updatedAt: 123 });
    expect(deserializeProgress(raw, 20)).toEqual({ page: 7, total: 20, updatedAt: 123 });
  });

  it("rejects malformed payloads", () => {
    expect(deserializeProgress(null, 20)).toBeNull();
    expect(deserializeProgress("not json", 20)).toBeNull();
    expect(deserializeProgress('"string"', 20)).toBeNull();
    expect(deserializeProgress("{}", 20)).toBeNull();
    expect(deserializeProgress('{"page":"7","total":20,"updatedAt":1}', 20)).toBeNull();
  });

  it("rejects a stored page that no longer fits the group", () => {
    const raw = serializeProgress({ page: 30, total: 30, updatedAt: 123 });
    expect(deserializeProgress(raw, 20)).toBeNull();
  });

  it("keys progress by group id", () => {
    expect(progressKey(9)).toBe("reader-progress:9");
  });
});
