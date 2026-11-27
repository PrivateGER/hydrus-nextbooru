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

function deckPost(n: number): DeckPost {
  return {
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

describe('SwipeDeck', () => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/favorite')) {
          favoriteCalls.push(init?.method ?? 'GET');
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
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('exhaustion after likes', () => {
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
  });

  describe('media preloading', () => {
    const videoPost = (n: number): DeckPost => ({
      ...deckPost(n),
      mimeType: 'video/mp4',
      extension: '.mp4',
      duration: 12_000,
    });
    let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let warmed: string[];

    beforeEach(() => {
      play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
      warmed = [];
      vi.stubGlobal(
        'Image',
        class {
          fetchPriority = 'auto';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(url: string) {
            warmed.push(url);
          }
        }
      );
    });

    function videoFor(n: number): HTMLVideoElement {
      const video = container.querySelector<HTMLVideoElement>(`video[src="/api/files/${hash(n)}.mp4"]`);
      if (!video) throw new Error(`no video for post ${n}`);
      return video;
    }

    async function loaded(element: HTMLElement, event: 'loadeddata' | 'load') {
      await act(async () => {
        element.dispatchEvent(new Event(event));
      });
      await flush();
    }

    it('buffers the videos under the top card in order, then plays the next one without reloading it', async () => {
      deckReplies.push(
        deckResponse([videoPost(1), videoPost(2), videoPost(3), deckPost(4), videoPost(5)], { remaining: 20 }),
        deckResponse([], { remaining: 20 })
      );
      await act(async () => root.render(<SwipeDeck />));
      await flush();

      // The top card gets the bandwidth first; beneath only stills.
      expect(videoFor(1).getAttribute('preload')).toBe('auto');
      expect(videoFor(2).getAttribute('preload')).toBe('metadata');
      expect(videoFor(3).getAttribute('preload')).toBe('none');
      expect(warmed).toEqual([]);

      await loaded(videoFor(1), 'loadeddata');
      expect(videoFor(2).getAttribute('preload')).toBe('auto');
      expect(videoFor(3).getAttribute('preload')).toBe('none');

      await loaded(videoFor(2), 'loadeddata');
      expect(videoFor(3).getAttribute('preload')).toBe('auto');
      expect(warmed).toEqual([]);

      // Whole stack up: warm the cards after it (image file, video thumbnail).
      await loaded(videoFor(3), 'loadeddata');
      expect(warmed).toEqual(
        expect.arrayContaining([
          `/api/thumbnails/${hash(4)}.webp?size=preview`,
          `/api/files/${hash(4)}.jpg`,
          `/api/thumbnails/${hash(5)}.webp?size=preview`,
        ])
      );
      expect(warmed).not.toContain(`/api/files/${hash(5)}.mp4`);

      const second = videoFor(2);
      play.mockClear();
      await press('Skip');
      await advance(150);
      expect(topCardLabel()).toBe('Post by artist 2');
      // Same element that buffered underneath: no remount, no spinner.
      expect(videoFor(2)).toBe(second);
      expect(play).toHaveBeenCalled();
      const topCard = container.querySelector('[aria-roledescription="card"][aria-hidden="false"]');
      expect(topCard?.contains(second)).toBe(true);
      expect(topCard?.querySelector('.animate-spin')).toBeNull();
    });

    it('holds the full image of a card beneath until the top card is up', async () => {
      deckReplies.push(deckResponse([deckPost(1), deckPost(2)], { remaining: 20 }), deckResponse([], { remaining: 20 }));
      await act(async () => root.render(<SwipeDeck />));
      await flush();

      const fullImage = (n: number) => container.querySelector<HTMLImageElement>(`img[src="/api/files/${hash(n)}.jpg"]`);
      expect(fullImage(1)).not.toBeNull();
      expect(fullImage(2)).toBeNull();

      await loaded(fullImage(1)!, 'load');
      expect(fullImage(2)).not.toBeNull();
    });
  });
});
