import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TagCategory } from '@/generated/prisma/client';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase, recalculatePostTagNorms } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags, createTag } from '../factories';
// Static route imports are safe: @/lib/db's prisma is a Proxy resolving the test client per access.
import * as deckRoute from '@/app/api/feed/deck/route';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import { clearFeedCache, settleFeedRebuild } from '@/lib/feed';
import type { DeckResult } from '@/lib/feed-deck';
import { startQueryCapture, stopQueryCapture, countableStatements } from '@/test/guards/query-capture';

const TASTE_TAGS = ['deck taste a', 'deck taste b', 'deck taste c'];

function deckRequest(body: unknown, raw = false) {
  return new NextRequest('http://localhost/api/feed/deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

async function fetchDeck(body: unknown = {}): Promise<DeckResult> {
  const response = await deckRoute.POST(deckRequest(body));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  return response.json();
}

async function favorite(hash: string) {
  const response = await favoriteRoute.PUT(
    new NextRequest(`http://localhost/api/posts/${hash}/favorite`, { method: 'PUT' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function tag(postId: number, name: string, category: TagCategory, postCount: number) {
  const prisma = getTestPrisma();
  const created = await createTag(prisma, name, category);
  await prisma.tag.update({ where: { id: created.id }, data: { postCount } });
  await prisma.postTag.create({ data: { postId, tagId: created.id } });
}

/** One favorite plus `count` tag-similar candidates, served by the tag fallback feed. */
async function seedFeed(count: number) {
  const prisma = getTestPrisma();
  const seed = await createPostWithTags(prisma, TASTE_TAGS);
  const candidates = [];
  for (let i = 0; i < count; i++) {
    candidates.push(await createPostWithTags(prisma, TASTE_TAGS));
  }
  await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
  await recalculatePostTagNorms();
  await favorite(seed.hash);
  clearFeedCache();
  return { seed, candidates };
}

describe('POST /api/feed/deck (Integration)', () => {
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

  afterEach(async () => {
    await settleFeedRebuild();
  });

  it('returns an empty deck when there are no favorites', async () => {
    await createPostWithTags(getTestPrisma(), TASTE_TAGS);
    const data = await fetchDeck();
    expect(data).toEqual({ posts: [], remaining: 0, totalCount: 0 });
  });

  it('deals unseen recommendations enriched for full-screen cards', async () => {
    const { seed, candidates } = await seedFeed(2);
    const [first] = candidates;
    await tag(first.id, 'popular_artist', TagCategory.ARTIST, 50);
    await tag(first.id, 'niche_artist', TagCategory.ARTIST, 2);
    await tag(first.id, 'some_character', TagCategory.CHARACTER, 10);
    await tag(first.id, 'some_series', TagCategory.COPYRIGHT, 10);
    await tag(first.id, 'meta_tag', TagCategory.META, 99);

    const data = await fetchDeck({ limit: 10 });
    const hashes = data.posts.map((post) => post.hash);

    expect(hashes).not.toContain(seed.hash);
    expect(new Set(hashes)).toEqual(new Set(candidates.map((c) => c.hash)));
    expect(data.totalCount).toBe(2);
    expect(data.remaining).toBe(0);

    const card = data.posts.find((post) => post.hash === first.hash)!;
    expect(card).toMatchObject({
      extension: '.png',
      hasAudio: false,
      duration: null,
      // Most popular first; GENERAL and META tags are not headline tags.
      artists: ['popular_artist', 'niche_artist'],
      characters: ['some_character'],
      copyrights: ['some_series'],
    });
    const other = data.posts.find((post) => post.hash !== first.hash)!;
    expect(other).toMatchObject({ artists: [], characters: [], copyrights: [] });
  });

  it('excludes already-seen hashes and pages by what is left, not by offset', async () => {
    const { candidates } = await seedFeed(4);
    const all = await fetchDeck({ limit: 30 });
    const ranked = all.posts.map((post) => post.hash);
    expect(ranked).toHaveLength(4);

    const batch = await fetchDeck({ limit: 2, exclude: [ranked[0], ranked[2].toUpperCase(), 'garbage', 7] });
    expect(batch.posts.map((post) => post.hash)).toEqual([ranked[1], ranked[3]]);
    expect(batch.remaining).toBe(0);
    expect(batch.totalCount).toBe(4);

    const none = await fetchDeck({ exclude: candidates.map((c) => c.hash) });
    expect(none.posts).toEqual([]);
    expect(none.remaining).toBe(0);
  });

  it('respects the batch limit and reports the remainder', async () => {
    await seedFeed(5);
    const data = await fetchDeck({ limit: 2 });
    expect(data.posts).toHaveLength(2);
    expect(data.remaining).toBe(3);
  });

  it('carries video metadata', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const created = await createPostWithTags(prisma, TASTE_TAGS);
    const video = await prisma.post.update({
      where: { id: created.id },
      data: { mimeType: 'video/mp4', extension: '.mp4', duration: 12_345, hasAudio: true },
    });
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms();
    await favorite(seed.hash);
    clearFeedCache();

    const data = await fetchDeck();
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0]).toMatchObject({ hash: video.hash, mimeType: 'video/mp4', extension: '.mp4', duration: 12_345, hasAudio: true });
  });

  it('serves a warm deck with a single enrichment statement', async () => {
    await seedFeed(3);
    await fetchDeck(); // cold build populates the feed cache
    await settleFeedRebuild();

    startQueryCapture();
    let count: number;
    try {
      await fetchDeck({ limit: 10 });
    } finally {
      count = countableStatements(stopQueryCapture()).length;
    }
    expect(count).toBe(1);
  });

  it('rejects malformed bodies', async () => {
    expect((await deckRoute.POST(deckRequest('{not json', true))).status).toBe(400);
    expect((await deckRoute.POST(deckRequest([1, 2]))).status).toBe(400);
    expect((await deckRoute.POST(deckRequest('null', true))).status).toBe(400);
  });

  it('treats an empty body as defaults', async () => {
    await seedFeed(1);
    const response = await deckRoute.POST(new NextRequest('http://localhost/api/feed/deck', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect((await response.json()).posts).toHaveLength(1);
  });

  it('refuses oversized bodies', async () => {
    const huge = JSON.stringify({ exclude: Array.from({ length: 3000 }, () => 'f'.repeat(64)) });
    const response = await deckRoute.POST(deckRequest(huge, true));
    expect(response.status).toBe(413);
  });
});
