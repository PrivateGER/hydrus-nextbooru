"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import type { FeedSwipeCounts } from "@/lib/swipes";
import { RECOMMENDED_FEED_SETTINGS, type UseFeedSettingsReturn } from "@/hooks/admin/use-feed-settings";

export interface FeedSectionProps {
  feed: UseFeedSettingsReturn;
}

const percent = (fraction: number) => Math.round(fraction * 100);

function Slider({
  id,
  label,
  hint,
  value,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  /** Whole percent. */
  value: number;
  max: number;
  step: number;
  display: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={`${id}-hint`}
        className="w-full accent-blue-600 disabled:opacity-50"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {hint}
      </p>
    </div>
  );
}

function SwipeRow({ label, counts }: { label: string; counts: FeedSwipeCounts }) {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-700">
      <th scope="row" className="py-2 pr-4 text-left font-normal text-zinc-700 dark:text-zinc-300">
        {label}
      </th>
      <td className="py-2 pr-4 text-right tabular-nums">{counts.liked}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{counts.skipped}</td>
      <td className="py-2 text-right tabular-nums">
        {counts.likeRate === null ? "–" : `${percent(counts.likeRate)}%`}
      </td>
    </tr>
  );
}

export function FeedSection({ feed }: FeedSectionProps) {
  const { status, draft, setDraft, isDirty, isSaving, loadError, save } = feed;

  if (!status || !draft) {
    return (
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {loadError ?? "Loading feed settings..."}
        </p>
      </Card>
    );
  }

  const variety = percent(1 - draft.diversityLambda);
  const explore = percent(draft.exploreShare);
  const flatten = percent(1 - draft.quotaExponent);
  const switchingToFavorites = draft.retrieval === "favorites" && status.settings.retrieval !== "favorites";
  const { allTime, recent, recentDays } = status.swipes;
  const noSwipes = allTime.taste.likeRate === null && allTime.explore.likeRate === null;
  const modeButton = (mode: "centroid" | "favorites", label: string) => (
    <button
      type="button"
      aria-pressed={draft.retrieval === mode}
      disabled={isSaving}
      onClick={() => setDraft({ retrieval: mode })}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        draft.retrieval === mode
          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">For You feed</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          How the recommendation feed and the swipe deck pick posts. Changes apply on the next rebuild; the
          previous feed keeps showing until it is ready.
        </p>

        <div className="space-y-5">
          <div>
            <p id="feed-mode-label" className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Match posts to</p>
            <div role="group" aria-labelledby="feed-mode-label" className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 p-1">
              {modeButton("centroid", "Cluster averages")}
              {modeButton("favorites", "Each favorite")}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {draft.retrieval === "favorites"
                ? "Searches around every favorite. Covers more of your taste; a liked exploration post brings its neighbors in."
                : "Searches around the average of each taste cluster. Strongest first page, narrowest reach."}
            </p>
          </div>

          <Slider
            id="feed-variety"
            label="Variety"
            hint="Pushes near-identical posts apart instead of showing them back to back."
            value={variety}
            max={100}
            step={5}
            display={variety === 0 ? "Off" : `${variety}%`}
            disabled={isSaving}
            onChange={(value) => setDraft({ diversityLambda: (100 - value) / 100 })}
          />
          <Slider
            id="feed-explore"
            label="Exploration"
            hint="Share of each page given to posts you have not seen that are unlike anything you favorited."
            value={explore}
            max={50}
            step={5}
            display={explore === 0 ? "Off" : `${explore}% of each page`}
            disabled={isSaving}
            onChange={(value) => setDraft({ exploreShare: value / 100 })}
          />
          <Slider
            id="feed-balance"
            label="Even out interests"
            hint="Stops your biggest interest from taking most of the page. At 100% every interest gets the same space."
            value={flatten}
            max={100}
            step={10}
            display={flatten === 0 ? "Off" : `${flatten}%`}
            disabled={isSaving}
            onChange={(value) => setDraft({ quotaExponent: (100 - value) / 100 })}
          />

          {switchingToFavorites && (
            <InfoBox variant="note">
              The first build after switching to &quot;Each favorite&quot; is slow (about half a minute on a large
              library). The current feed stays up until it finishes.
            </InfoBox>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={!isDirty} loading={isSaving}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => setDraft(RECOMMENDED_FEED_SETTINGS)} disabled={isSaving}>
              Use recommended
            </Button>
            <Button variant="secondary" onClick={() => setDraft(status.defaults)} disabled={isSaving}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">Swipe results</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          How cards in the swipe feed were answered. If exploration cards are liked about as often as normal
          ones, exploration is finding things worth keeping.
        </p>
        {noSwipes ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No swipes recorded yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { title: `Last ${recentDays} days`, stats: recent },
              { title: "All time", stats: allTime },
            ].map(({ title, stats }) => (
              <table key={title} className="w-full text-sm">
                <caption className="mb-1 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {title}
                </caption>
                <thead>
                  <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                    <td />
                    <th scope="col" className="pb-1 pr-4 text-right font-medium">Liked</th>
                    <th scope="col" className="pb-1 pr-4 text-right font-medium">Skipped</th>
                    <th scope="col" className="pb-1 text-right font-medium">Like rate</th>
                  </tr>
                </thead>
                <tbody>
                  <SwipeRow label="Normal cards" counts={stats.taste} />
                  <SwipeRow label="Exploration cards" counts={stats.explore} />
                </tbody>
              </table>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
