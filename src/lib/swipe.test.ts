import { describe, expect, it } from "vitest";
import {
  FLICK_VELOCITY,
  MAX_ROTATION_DEG,
  SWIPE_HISTORY_MAX,
  SWIPE_HISTORY_TTL_MS,
  SWIPE_MAX_THRESHOLD_PX,
  SWIPE_MIN_THRESHOLD_PX,
  dragRotation,
  fitMode,
  formatDuration,
  formatTagName,
  parseHistory,
  pruneHistory,
  recordSwipe,
  releaseVelocity,
  removeSwipe,
  resolveSwipe,
  swipeProgress,
  swipeThreshold,
  stackPreload,
  type SwipeHistoryEntry,
} from "./swipe";

const hash = (n: number) => n.toString(16).padStart(64, "0");

describe("swipeThreshold", () => {
  it("scales with card width within clamps", () => {
    expect(swipeThreshold(400)).toBeCloseTo(112);
    expect(swipeThreshold(100)).toBe(SWIPE_MIN_THRESHOLD_PX);
    expect(swipeThreshold(5000)).toBe(SWIPE_MAX_THRESHOLD_PX);
  });
});

describe("resolveSwipe", () => {
  const width = 400; // threshold 112px

  it("maps right to like and left to skip once past the threshold", () => {
    expect(resolveSwipe(120, 0, width)).toBe("like");
    expect(resolveSwipe(-120, 0, width)).toBe("skip");
  });

  it("springs back for short, slow drags", () => {
    expect(resolveSwipe(60, 0.1, width)).toBeNull();
    expect(resolveSwipe(-60, -0.1, width)).toBeNull();
    expect(resolveSwipe(0, 0, width)).toBeNull();
  });

  it("commits a fast flick below the distance threshold", () => {
    expect(resolveSwipe(40, FLICK_VELOCITY + 0.1, width)).toBe("like");
    expect(resolveSwipe(-40, -(FLICK_VELOCITY + 0.1), width)).toBe("skip");
  });

  it("ignores flicks that barely moved (twitchy taps)", () => {
    expect(resolveSwipe(10, 3, width)).toBeNull();
  });

  it("ignores a flick against the drag direction (user changed their mind)", () => {
    expect(resolveSwipe(60, -1.5, width)).toBeNull();
    expect(resolveSwipe(-60, 1.5, width)).toBeNull();
  });

  it("rejects non-finite input", () => {
    expect(resolveSwipe(Number.NaN, 0, width)).toBeNull();
    expect(resolveSwipe(200, Number.POSITIVE_INFINITY, width)).toBeNull();
  });
});

describe("swipeProgress / dragRotation", () => {
  it("progress is symmetric and saturates at 1", () => {
    expect(swipeProgress(56, 400)).toBeCloseTo(0.5);
    expect(swipeProgress(-56, 400)).toBeCloseTo(0.5);
    expect(swipeProgress(1000, 400)).toBe(1);
  });

  it("rotation follows the drag and is clamped", () => {
    expect(dragRotation(200, 400)).toBeCloseTo(MAX_ROTATION_DEG / 2);
    expect(dragRotation(-200, 400)).toBeCloseTo(-MAX_ROTATION_DEG / 2);
    expect(dragRotation(5000, 400)).toBe(MAX_ROTATION_DEG);
    expect(dragRotation(100, 0)).toBe(0);
  });
});

describe("releaseVelocity", () => {
  it("measures recent motion in px/ms", () => {
    const samples = [
      { x: 0, t: 0 },
      { x: 50, t: 50 },
      { x: 100, t: 100 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(1);
  });

  it("reads a pause before release as no velocity", () => {
    const samples = [
      { x: 0, t: 0 },
      { x: 200, t: 50 },
      { x: 200, t: 400 },
    ];
    expect(releaseVelocity(samples)).toBe(0);
  });

  it("returns 0 without enough samples", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ x: 5, t: 1 }])).toBe(0);
  });
});

describe("fitMode", () => {
  // A typical phone card: 380 x 640.
  const box = [380, 640] as const;

  it("contains ordinary portrait, square and landscape media", () => {
    expect(fitMode(1000, 1500, ...box)).toBe("contain");
    expect(fitMode(1000, 1000, ...box)).toBe("contain");
    expect(fitMode(1920, 1080, ...box)).toBe("contain");
  });

  it("scrolls very tall strips that would shrink to a sliver", () => {
    expect(fitMode(800, 8000, ...box)).toBe("scroll");
  });

  it("contains a tall image when the card is tall enough to show it well", () => {
    // 1:2.3 in a very tall, narrow card uses most of the width.
    expect(fitMode(1000, 2300, 300, 900)).toBe("contain");
  });

  it("never scrolls wide panoramas (horizontal scroll would fight the swipe)", () => {
    expect(fitMode(10000, 800, ...box)).toBe("contain");
  });

  it("falls back to contain without dimensions or a measured box", () => {
    expect(fitMode(null, 1000, ...box)).toBe("contain");
    expect(fitMode(800, 8000, 0, 0)).toBe("contain");
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });

  it("turns underscores into spaces in tag names", () => {
    expect(formatTagName("hatsune_miku")).toBe("hatsune miku");
  });
});

describe("swipe history", () => {
  const now = 1_800_000_000_000;

  it("records, replaces and removes entries", () => {
    let entries: SwipeHistoryEntry[] = [];
    entries = recordSwipe(entries, { hash: hash(1), action: "skip", at: now - 10 }, now);
    entries = recordSwipe(entries, { hash: hash(2), action: "like", at: now - 5 }, now);
    entries = recordSwipe(entries, { hash: hash(1), action: "like", at: now }, now);
    expect(entries.map((e) => [e.hash, e.action])).toEqual([
      [hash(2), "like"],
      [hash(1), "like"],
    ]);
    expect(removeSwipe(entries, hash(2)).map((e) => e.hash)).toEqual([hash(1)]);
  });

  it("expires old entries and caps the size, keeping the newest", () => {
    const old = { hash: hash(1), action: "skip" as const, at: now - SWIPE_HISTORY_TTL_MS - 1 };
    expect(pruneHistory([old], now)).toEqual([]);

    const many = Array.from({ length: SWIPE_HISTORY_MAX + 5 }, (_, i) => ({
      hash: hash(i + 1),
      action: "skip" as const,
      at: now - (SWIPE_HISTORY_MAX + 5 - i),
    }));
    const pruned = pruneHistory(many, now);
    expect(pruned).toHaveLength(SWIPE_HISTORY_MAX);
    expect(pruned[pruned.length - 1].hash).toBe(hash(SWIPE_HISTORY_MAX + 5));
    expect(pruned[0].hash).toBe(hash(6));
  });

  it("drops entries timestamped far in the future (clock skew, tampering)", () => {
    expect(pruneHistory([{ hash: hash(1), action: "skip", at: now + 86_400_000 }], now)).toEqual([]);
  });

  it("parses stored JSON defensively", () => {
    expect(parseHistory(null, now)).toEqual([]);
    expect(parseHistory("not json", now)).toEqual([]);
    expect(parseHistory('{"a":1}', now)).toEqual([]);
    const raw = JSON.stringify([
      { hash: hash(2), action: "like", at: now - 1 },
      { hash: hash(1), action: "skip", at: now - 2 },
      { hash: "short", action: "skip", at: now },
      { hash: hash(3), action: "nope", at: now },
      { hash: hash(4), action: "skip", at: "yesterday" },
      null,
      42,
    ]);
    expect(parseHistory(raw, now).map((e) => e.hash)).toEqual([hash(1), hash(2)]);
  });
});

describe("stackPreload", () => {
  it("always loads the top card in full", () => {
    expect(stackPreload(0, false, false)).toBe("auto");
    expect(stackPreload(0, false, true)).toBe("auto");
  });

  it("holds cards beneath back until everything above is up", () => {
    expect(stackPreload(1, false, false)).toBe("metadata");
    expect(stackPreload(2, false, false)).toBe("none");
    expect(stackPreload(1, true, false)).toBe("auto");
    expect(stackPreload(2, true, false)).toBe("auto");
  });

  it("keeps Data Saver to the next card's still", () => {
    expect(stackPreload(1, true, true)).toBe("metadata");
    expect(stackPreload(2, true, true)).toBe("none");
  });
});
