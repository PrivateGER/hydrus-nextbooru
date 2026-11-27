import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog } from "@/lib/logger";
import { invalidateFeedCache, warmFeedCache } from "@/lib/feed";
import {
  FEED_RETRIEVAL_MODES,
  FEED_SETTING_DEFAULTS,
  FEED_SETTING_LIMITS,
  getFeedSettings,
  updateFeedSettings,
  validateFeedSettingsUpdate,
} from "@/lib/feed-settings";
import { getFeedSwipeStats } from "@/lib/swipes";

const RECENT_DAYS = 7;

/**
 * "For You" feed options with their defaults and limits, plus how swipe-feed
 * cards were answered (exploration next to taste cards), all time and over
 * the last week.
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const [settings, allTime, recent] = await Promise.all([
      getFeedSettings(),
      getFeedSwipeStats(),
      getFeedSwipeStats(new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)),
    ]);
    return NextResponse.json({
      settings,
      defaults: FEED_SETTING_DEFAULTS,
      limits: FEED_SETTING_LIMITS,
      retrievalModes: FEED_RETRIEVAL_MODES,
      swipes: { allTime, recent, recentDays: RECENT_DAYS },
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to read feed settings");
    return NextResponse.json({ error: "Failed to read feed settings" }, { status: 500 });
  }
}

/**
 * Change feed options. Body: any of `retrieval`, `diversityLambda`,
 * `exploreShare`, `quotaExponent`; `null` resets one to its default. Invalid
 * input changes nothing.
 *
 * The cached feed is marked stale and a rebuild starts at once, so readers
 * keep the previous ranking until the new one is ready (switching to
 * favorites retrieval costs one slow first build).
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validated = validateFeedSettingsUpdate(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const settings = await updateFeedSettings(validated.update);
    invalidateFeedCache();
    warmFeedCache();
    return NextResponse.json({ settings });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to save feed settings");
    return NextResponse.json({ error: "Failed to save feed settings" }, { status: 500 });
  }
}
