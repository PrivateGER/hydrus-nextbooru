/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeckPost, DeckResult } from '@/lib/feed-deck';
import { SwipeDeck } from './swipe-deck';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

const hash = (n: number) => n.toString(16).padStart(64, '0');

function deckPost(n: number, explore = false): DeckPost {
  return {
    explore,
    id: n,
    hash: hash(n),
    width: 800,
    height: 1200,
    blurhash: null,
    mimeType: 'image/jpeg',
    extension: '.jpg',
    duration: null,
    hasAudio: false,
    artists: [`artist_${n}`],
    characters: [],
    copyrights: [],
  };
}

function deckResponse(posts: DeckPost[], overrides: Partial<DeckResult> = {}): Response {
  const body: DeckResult = { posts, remaining: 0, totalCount: 10, rebuilding: false, ...overrides };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** A deck response the test releases by hand, to hold a request in flight. */
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
let deckReplies: Array<Response | Promise<Response>>;
let favoriteCalls: string[];
let favoriteStatus: number;
/** Swipe outcome reports as `METHOD hash-number body`. */
let swipeCalls: string[];
/** When set, swipe reports hang until released. */
let swipeGate: Promise<void> | null;

function cardLabels(): string[] {
  return [...container.querySelectorAll('[aria-roledescription="card"]')]
    .filter((card) => card.getAttribute('aria-hidden') !== 'true')
    .map((card) => card.getAttribute('aria-label') ?? '');
}

function topCardLabel(): string | undefined {
  return cardLabels()[0];
}

/** Let fetch promises, React updates and effects settle. */
async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flush();
}

async function press(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`no ${label} button`);
  await act(async () => {
    button.click();
  });
}

describe('SwipeDeck exhaustion after likes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // Reduced motion keeps fly-outs at 120ms.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    window.localStorage.clear();

    deckReplies = [];
    favoriteCalls = [];
    favoriteStatus = 200;
    swipeCalls = [];
    swipeGate = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/favorite')) {
          favoriteCalls.push(init?.method ?? 'GET');
          return new Response('{}', { status: favoriteStatus });
        }
        if (url.endsWith('/swipe')) {
          const postNumber = parseInt(url.split('/').at(-2) ?? '', 16);
          swipeCalls.push([init?.method, postNumber, init?.body].filter((part) => part !== undefined).join(' '));
          if (swipeGate) await swipeGate;
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/feed/deck')) {
          const next = deckReplies.shift();
          if (!next) throw new Error('unexpected deck request');
          return next;
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reopens a caught-up deck when a like re-ranks the feed', async () => {
    deckReplies.push(
      deckResponse([deckPost(1)]), // whole feed: one card, nothing after it
      deckResponse([], { rebuilding: true }), // read after the like: stale ranking, rebuild running
      deckResponse([deckPost(2)]) // rebuilt ranking surfaces a new post
    );

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    expect(topCardLabel()).toBe('Post by artist 1');

    await press('Like');
    await advance(150); // fly-out ends, like commits and is saved
    expect(favoriteCalls).toEqual(['PUT']);
    expect(container.textContent).not.toContain("You're all caught up");

    await advance(2000); // provisional answer: re-read once
    expect(topCardLabel()).toBe('Post by artist 2');
    expect(deckReplies).toHaveLength(0);
  });

  it('does not trust a "nothing left" answer that raced a like', async () => {
    const racing = deferred();
    deckReplies.push(
      deckResponse([deckPost(1), deckPost(3)], { remaining: 1 }),
      racing.promise, // refill fired right away (queue is short), still in flight
      deckResponse([deckPost(2)]) // the re-read after the like
    );

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    expect(topCardLabel()).toBe('Post by artist 1');

    await press('Like');
    await advance(150);
    expect(favoriteCalls).toEqual(['PUT']);

    // The in-flight refill was answered from the pre-like ranking.
    racing.resolve(deckResponse([], { rebuilding: false }));
    await flush();
    await advance(2000);

    await press('Skip');
    await advance(150);
    expect(topCardLabel()).toBe('Post by artist 2');
    expect(container.textContent).not.toContain("You're all caught up");
  });

  it('still reports caught up when nothing new appears', async () => {
    deckReplies.push(deckResponse([deckPost(1)]));

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    await press('Skip');
    await advance(150);

    expect(cardLabels()).toEqual([]);
    expect(container.textContent).toContain("You're all caught up");
    expect(deckReplies).toHaveLength(0);
  });

  it('reports each answered card, and whether it was an exploration card', async () => {
    deckReplies.push(deckResponse([deckPost(1), deckPost(2, true), deckPost(3)], { remaining: 0 }), deckResponse([]));

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    await press('Skip');
    await advance(150);
    await press('Like');
    await advance(150);

    expect(swipeCalls).toEqual([
      'PUT 1 {"action":"skip","explore":false}',
      'PUT 2 {"action":"like","explore":true}',
    ]);
    // The like was saved as a favorite before it was reported.
    expect(favoriteCalls).toEqual(['PUT']);
  });

  it('shows an exploration card like any other card', async () => {
    deckReplies.push(deckResponse([deckPost(1, true), deckPost(2)]), deckResponse([]));

    await act(async () => root.render(<SwipeDeck />));
    await flush();

    const card = (label: string) => container.querySelector(`[aria-roledescription="card"][aria-label="${label}"]`);
    const explore = card('Post by artist 1');
    const normal = card('Post by artist 2');
    expect(explore).not.toBeNull();
    expect(normal).not.toBeNull();
    // Same caption, nothing extra: only the artist differs.
    expect(explore?.textContent?.replace('artist 1', '')).toBe(normal?.textContent?.replace('artist 2', ''));
  });

  it('withdraws the report on undo and never reports a like that failed to save', async () => {
    deckReplies.push(deckResponse([deckPost(1), deckPost(2)]), deckResponse([]), deckResponse([]));

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    await press('Skip');
    await advance(150);
    await press('Undo');
    await flush();
    expect(swipeCalls).toEqual(['PUT 1 {"action":"skip","explore":false}', 'DELETE 1']);
    expect(topCardLabel()).toBe('Post by artist 1');

    favoriteStatus = 500;
    swipeCalls = [];
    await press('Like');
    await advance(150);
    expect(favoriteCalls).toEqual(['PUT']);
    expect(swipeCalls).toEqual([]);
    // The card is back on top for another try.
    expect(topCardLabel()).toBe('Post by artist 1');
  });

  it('undoes a like even while its report is stuck', async () => {
    deckReplies.push(deckResponse([deckPost(1), deckPost(2)]), deckResponse([]), deckResponse([]));
    let release!: () => void;
    swipeGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await act(async () => root.render(<SwipeDeck />));
    await flush();
    await press('Like');
    await advance(150);
    expect(favoriteCalls).toEqual(['PUT']);
    expect(swipeCalls).toEqual(['PUT 1 {"action":"like","explore":false}']); // sent, never answered

    await press('Undo');
    await flush();
    // The favorite is removed without waiting for the report.
    expect(favoriteCalls).toEqual(['PUT', 'DELETE']);

    release();
    await flush();
    // Reports keep their own order: the withdrawal follows the stuck report.
    expect(swipeCalls).toEqual(['PUT 1 {"action":"like","explore":false}', 'DELETE 1']);
  });
});
