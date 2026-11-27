/**
 * "For You" feed options an admin can change at runtime (admin panel, For
 * You section). Stored as rows in the Settings table; a missing row means the
 * default. A feed build that serves the app reads them once and overlays
 * them on FEED_CONFIG; tests and tools that pass an explicit config to
 * buildFeed do not read them.
 *
 * Only the switches a person would tune live here. Everything else in
 * FEED_CONFIG (cluster count, sample sizes, cutoffs) stays in code.
 */

import { prisma } from "@/lib/db";
import type { FeedRetrieval } from "@/lib/feed";

export const FEED_RETRIEVAL_MODES: readonly FeedRetrieval[] = ["centroid", "favorites"];

export interface FeedSettings {
  /** Where taste candidates come from: cluster averages or each favorite's own neighbors. */
  retrieval: FeedRetrieval;
  /** Variety pass (MMR) strength as its lambda: 1 is off, lower pushes near-twins apart. */
  diversityLambda: number;
  /** Share of every page given to exploration (unseen posts unlike every favorite). */
  exploreShare: number;
  /** Exponent on cluster mass when dividing a page: 1 proportional, 0 equal. */
  quotaExponent: number;
}

export type FeedSettingName = keyof FeedSettings;

/** Code defaults: everything off, the feed as it was before these options existed. */
export const FEED_SETTING_DEFAULTS: Readonly<FeedSettings> = {
  retrieval: "centroid",
  diversityLambda: 1,
  exploreShare: 0,
  quotaExponent: 1,
};

/** Inclusive ranges for the numeric options. */
export const FEED_SETTING_LIMITS = {
  diversityLambda: { min: 0, max: 1 },
  exploreShare: { min: 0, max: 0.5 },
  quotaExponent: { min: 0, max: 1 },
} as const satisfies Record<Exclude<FeedSettingName, "retrieval">, { min: number; max: number }>;

export const FEED_SETTING_KEYS: Readonly<Record<FeedSettingName, string>> = {
  retrieval: "feed.retrieval",
  diversityLambda: "feed.diversityLambda",
  exploreShare: "feed.exploreShare",
  quotaExponent: "feed.quotaExponent",
};

const NAMES = Object.keys(FEED_SETTING_KEYS) as FeedSettingName[];
const NAME_BY_KEY = new Map(NAMES.map((name) => [FEED_SETTING_KEYS[name], name]));

function isRetrieval(value: unknown): value is FeedRetrieval {
  return typeof value === "string" && (FEED_RETRIEVAL_MODES as readonly string[]).includes(value);
}

function inRange(name: Exclude<FeedSettingName, "retrieval">, value: number): boolean {
  const { min, max } = FEED_SETTING_LIMITS[name];
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Stored values that are valid, by name. A row holding anything else (edited
 * by hand, or written by an older version) is left out, so that option keeps
 * its default instead of breaking the feed.
 */
export function parseStoredFeedSettings(
  rows: readonly { key: string; value: string }[]
): Partial<FeedSettings> {
  const stored: Partial<FeedSettings> = {};
  for (const { key, value } of rows) {
    const name = NAME_BY_KEY.get(key);
    if (!name) continue;
    if (name === "retrieval") {
      if (isRetrieval(value)) stored.retrieval = value;
      continue;
    }
    const number = value.trim() === "" ? Number.NaN : Number(value);
    if (inRange(name, number)) stored[name] = number;
  }
  return stored;
}

/** An admin's change: a value sets the option, null resets it to its default. */
export type FeedSettingsUpdate = { [K in FeedSettingName]?: FeedSettings[K] | null };

/**
 * Check an update from the admin API. Rejects unknown names and out-of-range
 * or mistyped values outright rather than clamping, so a typo cannot quietly
 * save something other than what was asked for.
 */
export function validateFeedSettingsUpdate(
  input: unknown
): { update: FeedSettingsUpdate } | { error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { error: "Body must be a JSON object" };
  }
  const update: FeedSettingsUpdate = {};
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (!NAMES.includes(name as FeedSettingName)) {
      return { error: `Unknown setting: ${name}` };
    }
    const settingName = name as FeedSettingName;
    if (value === null) {
      update[settingName] = null;
      continue;
    }
    if (settingName === "retrieval") {
      if (!isRetrieval(value)) {
        return { error: `retrieval must be one of: ${FEED_RETRIEVAL_MODES.join(", ")}` };
      }
      update.retrieval = value;
      continue;
    }
    if (typeof value !== "number" || !inRange(settingName, value)) {
      const { min, max } = FEED_SETTING_LIMITS[settingName];
      return { error: `${settingName} must be a number from ${min} to ${max}` };
    }
    update[settingName] = value;
  }
  if (Object.keys(update).length === 0) {
    return { error: "No settings to change" };
  }
  return { update };
}

/** The stored options (valid ones only). One statement. */
export async function getStoredFeedSettings(): Promise<Partial<FeedSettings>> {
  const rows = await prisma.settings.findMany({
    where: { key: { in: NAMES.map((name) => FEED_SETTING_KEYS[name]) } },
    select: { key: true, value: true },
  });
  return parseStoredFeedSettings(rows);
}

/** Defaults overlaid with the stored options. */
export async function getFeedSettings(): Promise<FeedSettings> {
  return { ...FEED_SETTING_DEFAULTS, ...(await getStoredFeedSettings()) };
}

/**
 * Apply a validated update in one transaction. The caller is responsible for
 * invalidating the cached feed afterwards.
 */
export async function updateFeedSettings(update: FeedSettingsUpdate): Promise<FeedSettings> {
  const writes = Object.entries(update).map(([name, value]) => {
    const key = FEED_SETTING_KEYS[name as FeedSettingName];
    return value === null || value === undefined
      ? prisma.settings.deleteMany({ where: { key } })
      : prisma.settings.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        });
  });
  await prisma.$transaction(writes);
  return getFeedSettings();
}
