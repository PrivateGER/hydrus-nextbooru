import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  FEED_SETTING_DEFAULTS,
  FEED_SETTING_KEYS,
  parseStoredFeedSettings,
  validateFeedSettingsUpdate,
} from "./feed-settings";

const row = (name: keyof typeof FEED_SETTING_KEYS, value: string) => ({ key: FEED_SETTING_KEYS[name], value });

describe("parseStoredFeedSettings", () => {
  it("reads every valid option and nothing else", () => {
    expect(
      parseStoredFeedSettings([
        row("retrieval", "favorites"),
        row("diversityLambda", "0.7"),
        row("exploreShare", "0.1"),
        row("quotaExponent", "0"),
        { key: "openrouter.apiKey", value: "sk-or-v1-x" },
      ])
    ).toEqual({ retrieval: "favorites", diversityLambda: 0.7, exploreShare: 0.1, quotaExponent: 0 });
  });

  it("leaves out values that are malformed or out of range, so their defaults apply", () => {
    expect(
      parseStoredFeedSettings([
        row("retrieval", "interests"),
        row("diversityLambda", ""),
        row("exploreShare", "0.9"),
        row("quotaExponent", "half"),
      ])
    ).toEqual({});
    expect(parseStoredFeedSettings([row("exploreShare", "0.5"), row("diversityLambda", "1")])).toEqual({
      exploreShare: 0.5,
      diversityLambda: 1,
    });
  });

  it("defaults to the feed as it was before these options existed", () => {
    expect(FEED_SETTING_DEFAULTS).toEqual({ retrieval: "centroid", diversityLambda: 1, exploreShare: 0, quotaExponent: 1 });
  });
});

describe("validateFeedSettingsUpdate", () => {
  it("accepts values in range and null as reset", () => {
    expect(
      validateFeedSettingsUpdate({ retrieval: "favorites", exploreShare: 0.1, quotaExponent: null })
    ).toEqual({ update: { retrieval: "favorites", exploreShare: 0.1, quotaExponent: null } });
    expect(validateFeedSettingsUpdate({ diversityLambda: 0 })).toEqual({ update: { diversityLambda: 0 } });
  });

  it.each([
    [null, "Body must be a JSON object"],
    [["retrieval"], "Body must be a JSON object"],
    [{}, "No settings to change"],
    [{ retreival: "favorites" }, "Unknown setting: retreival"],
    [{ retrieval: "interests" }, "retrieval must be one of: centroid, favorites"],
    [{ exploreShare: 0.6 }, "exploreShare must be a number from 0 to 0.5"],
    [{ exploreShare: "0.1" }, "exploreShare must be a number from 0 to 0.5"],
    [{ quotaExponent: -0.1 }, "quotaExponent must be a number from 0 to 1"],
    [{ diversityLambda: Number.NaN }, "diversityLambda must be a number from 0 to 1"],
    // One bad value rejects the whole update.
    [{ retrieval: "favorites", exploreShare: 2 }, "exploreShare must be a number from 0 to 0.5"],
  ])("rejects %j", (input, error) => {
    expect(validateFeedSettingsUpdate(input)).toEqual({ error });
  });
});
