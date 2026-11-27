/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedSection } from './feed-section';
import { useFeedSettings } from '@/hooks/admin/use-feed-settings';

const DEFAULTS = { retrieval: 'centroid', diversityLambda: 1, exploreShare: 0, quotaExponent: 1 };
const counts = (liked: number, skipped: number) => ({
  liked,
  skipped,
  likeRate: liked + skipped > 0 ? liked / (liked + skipped) : null,
});

let container: HTMLDivElement;
let root: Root;
let saved: unknown[];
let stored: Record<string, unknown>;
const setMessage = vi.fn();

function Harness() {
  const feed = useFeedSettings(setMessage, () => {});
  return <FeedSection feed={feed} />;
}

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
}
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name)!;
const click = async (name: string) => { await act(async () => button(name).click()); await flush(); };

describe('FeedSection', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    saved = [];
    stored = { ...DEFAULTS, exploreShare: 0.1 };
    setMessage.mockReset();
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        saved.push(body);
        for (const [name, value] of Object.entries(body)) stored[name] = value ?? DEFAULTS[name as keyof typeof DEFAULTS];
        return new Response(JSON.stringify({ settings: stored }), { status: 200 });
      }
      return new Response(JSON.stringify({
        settings: stored,
        defaults: DEFAULTS,
        swipes: {
          allTime: { taste: counts(30, 70), explore: counts(4, 6) },
          recent: { taste: counts(0, 0), explore: counts(0, 0) },
          recentDays: 7,
        },
      }), { status: 200 });
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('shows the saved options and the swipe results', async () => {
    await act(async () => root.render(<Harness />));
    await flush();

    expect(container.textContent).toContain('10% of each page');
    expect(button('Save').disabled).toBe(true);
    // Exploration cards: 4 liked of 10; normal cards: 30 of 100. No swipes this week.
    expect(container.textContent).toContain('40%');
    expect(container.textContent).toContain('30%');
    expect(container.textContent).toContain('–');
  });

  it('saves only what changed, and clears an option that is back at its default', async () => {
    await act(async () => root.render(<Harness />));
    await flush();

    await click('Use recommended');
    expect(button('Save').disabled).toBe(false);
    expect(container.textContent).toContain('about half a minute');
    await click('Save');
    // Exploration was already 10%, so it is not sent again.
    expect(saved).toEqual([{ retrieval: 'favorites', diversityLambda: 0.7, quotaExponent: 0.5 }]);
    expect(button('Save').disabled).toBe(true);
    expect(setMessage).toHaveBeenLastCalledWith({ type: 'success', text: 'Feed settings saved. The feed is rebuilding.' });

    await click('Reset to defaults');
    await click('Save');
    expect(saved[1]).toEqual({ retrieval: null, diversityLambda: null, exploreShare: null, quotaExponent: null });
  });

  it('reports a failed save and keeps the edits', async () => {
    await act(async () => root.render(<Harness />));
    await flush();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'exploreShare must be a number from 0 to 0.5' }), { status: 400 }));

    await click('Use recommended');
    await click('Save');

    expect(setMessage).toHaveBeenLastCalledWith({ type: 'error', text: 'exploreShare must be a number from 0 to 0.5' });
    expect(button('Save').disabled).toBe(false);
  });

  it('locks the controls while a save is in flight, so no edit can be overwritten by its result', async () => {
    await act(async () => root.render(<Harness />));
    await flush();
    let respond!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { respond = resolve; }));
    const controls = () => [...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input[type="range"], button[aria-pressed]')];

    await click('Use recommended');
    expect(controls().length).toBe(5);
    expect(controls().every((control) => !control.disabled)).toBe(true);
    await act(async () => button('Save').click());
    expect(controls().every((control) => control.disabled)).toBe(true);

    await act(async () => respond(new Response(JSON.stringify({ settings: { ...DEFAULTS, retrieval: 'favorites' } }), { status: 200 })));
    await flush();
    expect(controls().every((control) => !control.disabled)).toBe(true);
  });
});
