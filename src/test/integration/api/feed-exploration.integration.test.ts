import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Post } from '@/generated/prisma/client';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from '../factories';
// Static route imports are safe: @/lib/db's prisma is a Proxy resolving the test client per access.
import * as deckRoute from '@/app/api/feed/deck/route';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import * as dismissalRoute from '@/app/api/posts/[hash]/dismissal/route';
import * as viewRoute from '@/app/api/posts/[hash]/view/route';
import * as swipeRoute from '@/app/api/posts/[hash]/swipe/route';
import { clearFeedCache } from '@/lib/feed';
import { updateFeedSettings } from '@/lib/feed-settings';
import { getFeedSwipeStats } from '@/lib/swipes';
import type { DeckResult } from '@/lib/feed-deck';
import { sampleUnseenEmbeddedPostIds, upsertCompleteEmbedding } from '@/lib/embeddings/store';

const DIMENSIONS = 768;
const EMBEDDING_CONFIG = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-embedding-2-preview',
  dimensions: DIMENSIONS,
  imageMaxResolution: 1024,
  videoEnabled: false,
};

const params = (hash: string) => ({ params: Promise.resolve({ hash }) });

async function put(route: { PUT: (request: NextRequest, context: ReturnType<typeof params>) => Promise<Response> }, path: string, hash: string) {
  const response = await route.PUT(new NextRequest(`http://localhost/api/posts/${hash}/${path}`, { method: 'PUT' }), params(hash));
  expect(response.status).toBe(200);
}

function swipeRequest(hash: string, body: unknown, raw = false) {
  return new NextRequest(`http://localhost/api/posts/${hash}/swipe`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

async function swipe(hash: string, action: 'like' | 'skip', explore: boolean) {
  const response = await swipeRoute.PUT(swipeRequest(hash, { action, explore }), params(hash));
  expect(response.status).toBe(200);
}

async function fetchDeck(): Promise<DeckResult> {
  const response = await deckRoute.POST(
    new NextRequest('http://localhost/api/feed/deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 30 }),
    })
  );
  expect(response.status).toBe(200);
  return response.json();
}

/** The summary the admin panel shows, optionally limited to the last `days`. */
async function swipeStats(days?: number) {
  return getFeedSwipeStats(days === undefined ? undefined : new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

/** A post whose embedding is `head` followed by zeros. */
async function embed(name: string, head: number[]): Promise<Post> {
  const prisma = getTestPrisma();
  const post = await createPostWithTags(prisma, [name]);
  await upsertCompleteEmbedding({
    postId: post.id,
    config: EMBEDDING_CONFIG,
    embedding: [...head, ...Array.from({ length: DIMENSIONS - head.length }, () => 0)],
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
  });
  return post;
}

async function configureEmbeddings() {
  await getTestPrisma().settings.createMany({
    data: [
      { key: 'openrouter.apiKey', value: 'sk-or-v1-test' },
      { key: 'openrouter.embedding.model', value: EMBEDDING_CONFIG.model },
      { key: 'openrouter.embedding.dimensions', value: String(DIMENSIONS) },
      { key: 'openrouter.embedding.imageMaxResolution', value: String(EMBEDDING_CONFIG.imageMaxResolution) },
    ],
  });
}

describe('Feed exploration and swipe records (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    clearFeedCache();
  });

  it('deals unseen posts unlike every favorite as exploration cards, and nothing the user has already met', async () => {
    const prisma = getTestPrisma();
    await configureEmbeddings();
    // Taste: three favorites around the first axis and two candidates next to them.
    const favorites = [
      await embed('favorite a', [1, 0, 0, 0, 0, 0, 0, 0]),
      await embed('favorite b', [1, 0.05, 0, 0, 0, 0, 0, 0]),
      await embed('favorite c', [1, -0.05, 0, 0, 0, 0, 0, 0]),
    ];
    // Six of them: exploration is capped at its share of what taste can fill.
    const nearby: Post[] = [];
    for (const offset of [0.1, -0.1, 0.12, -0.12, 0.14, -0.14]) {
      nearby.push(await embed(`nearby ${offset}`, [1, offset, 0, 0, 0, 0, 0, 0]));
    }
    // Unseen and nowhere near a favorite: each on an axis of its own.
    const fresh = [
      await embed('fresh 1', [0, 0, 1, 0, 0, 0, 0, 0]),
      await embed('fresh 2', [0, 0, 0, 1, 0, 0, 0, 0]),
      await embed('fresh 3', [0, 0, 0, 0, 1, 0, 0, 0]),
    ];
    // Just as far away, but already met in one way or another.
    const viewed = await embed('viewed', [0, 0, 0, 0, 0, 1, 0, 0]);
    const swiped = await embed('swiped', [0, 0, 0, 0, 0, 0, 1, 0]);
    const dismissed = await embed('dismissed', [0, 0, 0, 0, 0, 0, 0, 1]);
    const sibling = await embed('favorite sibling', [0, 0, 0.7, 0.7, 0, 0, 0, 0]);
    const group = await prisma.group.create({ data: { sourceType: 'PIXIV', sourceId: 'explore-sibling-group' } });
    await prisma.postGroup.createMany({
      data: [
        { postId: favorites[0].id, groupId: group.id, position: 0 },
        { postId: sibling.id, groupId: group.id, position: 1 },
      ],
    });
    for (const post of favorites) await put(favoriteRoute, 'favorite', post.hash);
    await put(dismissalRoute, 'dismissal', dismissed.hash);
    await viewRoute.POST(new NextRequest(`http://localhost/api/posts/${viewed.hash}/view`, { method: 'POST' }), params(viewed.hash));
    await swipe(swiped.hash, 'skip', true);

    // Off by default: the deck is taste cards only.
    clearFeedCache();
    const plain = await fetchDeck();
    expect(plain.posts.map((post) => post.hash).sort()).toEqual(nearby.map((post) => post.hash).sort());
    expect(plain.posts.every((post) => post.explore === false)).toBe(true);

    // Turned on the way the admin panel does it: a stored option.
    await updateFeedSettings({ exploreShare: 0.5 });
    clearFeedCache();
    const deck = await fetchDeck();
    const explored = deck.posts.filter((post) => post.explore).map((post) => post.hash);
    expect(explored.sort()).toEqual(fresh.map((post) => post.hash).sort());
    expect(deck.posts.filter((post) => !post.explore).map((post) => post.hash).sort()).toEqual(
      nearby.map((post) => post.hash).sort()
    );
    const dealt = new Set(deck.posts.map((post) => post.hash));
    for (const post of [viewed, swiped, dismissed, sibling, ...favorites]) expect(dealt.has(post.hash)).toBe(false);

    // A skipped exploration card is no longer "unseen": it is not dealt again.
    await swipe(fresh[0].hash, 'skip', true);
    clearFeedCache();
    const afterSkip = await fetchDeck();
    expect(afterSkip.posts.filter((post) => post.explore).map((post) => post.hash).sort()).toEqual(
      [fresh[1].hash, fresh[2].hash].sort()
    );
    // ...while a skipped taste card stays in the ranking (a skip is not a dismissal).
    await swipe(nearby[0].hash, 'skip', false);
    clearFeedCache();
    expect((await fetchDeck()).posts.map((post) => post.hash)).toContain(nearby[0].hash);
  });

  it('records the latest swipe per post and summarizes exploration next to taste cards', async () => {
    const prisma = getTestPrisma();
    const [a, b, c, d] = await Promise.all(
      ['a', 'b', 'c', 'd'].map((name) => createPostWithTags(prisma, [`swipe ${name}`]))
    );
    expect(await swipeStats()).toEqual({
      taste: { liked: 0, skipped: 0, likeRate: null },
      explore: { liked: 0, skipped: 0, likeRate: null },
    });

    await swipe(a.hash, 'skip', false);
    await swipe(b.hash, 'like', false);
    await swipe(c.hash, 'skip', true);
    await swipe(d.hash, 'skip', true);
    // Changing one's mind replaces the record instead of adding one.
    await swipe(d.hash, 'like', true);

    expect(await prisma.feedSwipe.count()).toBe(4);
    expect(await swipeStats()).toEqual({
      taste: { liked: 1, skipped: 1, likeRate: 0.5 },
      explore: { liked: 1, skipped: 1, likeRate: 0.5 },
    });
    // Recording a swipe is not a favorite and not a dismissal.
    expect(await prisma.favorite.count()).toBe(0);
    expect(await prisma.feedDismissal.count()).toBe(0);

    // Undo forgets the swipe; undoing twice is harmless.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await swipeRoute.DELETE(
        new NextRequest(`http://localhost/api/posts/${d.hash}/swipe`, { method: 'DELETE' }),
        params(d.hash)
      );
      expect(response.status).toBe(200);
    }
    expect((await swipeStats()).explore).toEqual({ liked: 0, skipped: 1, likeRate: 0 });

    // An old swipe falls outside a recent window.
    await prisma.feedSwipe.update({
      where: { postId: c.id },
      data: { swipedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });
    expect((await swipeStats(7)).explore).toEqual({ liked: 0, skipped: 0, likeRate: null });
    expect((await swipeStats(30)).explore).toEqual({ liked: 0, skipped: 1, likeRate: 0 });

    // Deleting the post takes its record with it.
    await prisma.post.delete({ where: { id: a.id } });
    expect(await prisma.feedSwipe.count()).toBe(2);
  });

  it('rejects malformed swipe reports without recording anything', async () => {
    const prisma = getTestPrisma();
    const post = await createPostWithTags(prisma, ['swipe validation']);
    const unknown = 'f'.repeat(64);

    const cases: Array<[NextRequest, string, number]> = [
      [swipeRequest(post.hash, '{not json', true), post.hash, 400],
      [swipeRequest(post.hash, ['like']), post.hash, 400],
      [swipeRequest(post.hash, { action: 'dismiss' }), post.hash, 400],
      [swipeRequest(post.hash, {}), post.hash, 400],
      [swipeRequest(post.hash, { action: 'like', explore: 'yes' }), post.hash, 400],
      [swipeRequest(unknown, { action: 'like' }), unknown, 404],
      [swipeRequest('nope', { action: 'like' }), 'nope', 400],
    ];
    for (const [request, hash, status] of cases) {
      expect((await swipeRoute.PUT(request, params(hash))).status).toBe(status);
    }
    expect(await prisma.feedSwipe.count()).toBe(0);

    // explore is optional and defaults to false.
    expect((await swipeRoute.PUT(swipeRequest(post.hash, { action: 'skip' }), params(post.hash))).status).toBe(200);
    expect(await prisma.feedSwipe.findUnique({ where: { postId: post.id } })).toMatchObject({
      action: 'SKIP',
      explore: false,
    });
  });

  it('samples unseen embedded posts deterministically per seed', async () => {
    const prisma = getTestPrisma();
    const posts: Post[] = [];
    for (let index = 0; index < 12; index++) posts.push(await embed(`sample ${index}`, [1, index]));
    const unembedded = await createPostWithTags(prisma, ['no embedding']);
    // One post each for the four ways of having met a post already.
    await put(favoriteRoute, 'favorite', posts[0].hash);
    await put(dismissalRoute, 'dismissal', posts[1].hash);
    await viewRoute.POST(new NextRequest(`http://localhost/api/posts/${posts[2].hash}/view`, { method: 'POST' }), params(posts[2].hash));
    await swipe(posts[3].hash, 'skip', false);
    const eligible = posts.slice(4).map((post) => post.id).sort((left, right) => left - right);

    const sample = (seed: number, limit = 100) =>
      sampleUnseenEmbeddedPostIds({ config: EMBEDDING_CONFIG, limit, seed });

    const first = await sample(1);
    expect([...first].sort((left, right) => left - right)).toEqual(eligible);
    expect(first).not.toContain(unembedded.id);
    expect(await sample(1)).toEqual(first);
    // Some other seed orders the same posts differently.
    const orders = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) orders.add((await sample(seed)).join(','));
    expect(orders.size).toBeGreaterThan(1);
    // The limit takes a prefix of that seed's order.
    expect(await sample(1, 4)).toEqual(first.slice(0, 4));
    expect(await sample(1, 0)).toEqual([]);
    // Another embedding config has no posts at all.
    expect(await sampleUnseenEmbeddedPostIds({ config: { ...EMBEDDING_CONFIG, model: 'other-model' }, limit: 10, seed: 1 })).toEqual([]);
  });
});
