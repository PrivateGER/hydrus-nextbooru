import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Post } from '@/generated/prisma/client';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase, recalculateTagStats } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from '../factories';
// Static route imports are safe here: @/lib/db's prisma is a Proxy resolving the test client per property access, and these modules do no top-level DB work (unlike suites using vi.doMock, which need dynamic imports).
import * as feedRoute from '@/app/api/feed/route';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import * as dismissalRoute from '@/app/api/posts/[hash]/dismissal/route';
import * as viewRoute from '@/app/api/posts/[hash]/view/route';
import { invalidateFeedCache } from '@/lib/feed';
import { startQueryCapture, stopQueryCapture, countableStatements } from '@/test/guards/query-capture';

const TASTE_TAGS = ['1girl', 'blue hair', 'school uniform'];

function get(url: string) {
  return new NextRequest(url);
}

async function favorite(hash: string) {
  const response = await favoriteRoute.PUT(
    new NextRequest(`http://localhost/api/posts/${hash}/favorite`, { method: 'PUT' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function dismiss(hash: string) {
  const response = await dismissalRoute.PUT(
    new NextRequest(`http://localhost/api/posts/${hash}/dismissal`, { method: 'PUT' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function view(hash: string) {
  const response = await viewRoute.POST(
    new NextRequest(`http://localhost/api/posts/${hash}/view`, { method: 'POST' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function fetchFeed(url = 'http://localhost/api/feed') {
  const response = await feedRoute.GET(get(url));
  expect(response.status).toBe(200);
  return response.json();
}

async function captureCountedStatements<T>(fn: () => Promise<T>): Promise<{ result: T; count: number }> {
  startQueryCapture();
  try {
    const result = await fn();
    const count = countableStatements(stopQueryCapture()).length;
    return { result, count };
  } catch (error) {
    stopQueryCapture();
    throw error;
  }
}

async function captureFeedFetch(url = 'http://localhost/api/feed') {
  return captureCountedStatements(() => fetchFeed(url));
}

function feedHashes(data: { posts: Array<{ hash: string }> }) {
  return data.posts.map((post) => post.hash);
}

async function createTasteCluster(tags: string[], candidateCount = 1) {
  const prisma = getTestPrisma();
  const seed = await createPostWithTags(prisma, tags);
  const similar: Post[] = [];
  for (let i = 0; i < candidateCount; i++) {
    similar.push(await createPostWithTags(prisma, tags));
  }
  return { seed, similar };
}

async function seedCacheableFeed(tags: string[], candidateCount = 2) {
  const prisma = getTestPrisma();
  const cluster = await createTasteCluster(tags, candidateCount);
  await createPostWithTags(prisma, [`unrelated ${tags[0]}`]);
  await recalculateTagStats();
  await favorite(cluster.seed.hash);
  return cluster;
}

describe('GET /api/feed (Integration)', () => {
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
  });

  it('returns an empty feed with no favorites (cold start)', async () => {
    await createPostWithTags(getTestPrisma(), TASTE_TAGS);

    const data = await fetchFeed();
    expect(data.posts).toEqual([]);
    expect(data.totalCount).toBe(0);
    expect(data.totalPages).toBe(0);
  });

  it('recommends tag-similar posts and never the favorites themselves', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    const unrelated = await createPostWithTags(prisma, ['landscape photo', 'mountain']);
    // IDF weights are precomputed in production by sync; set them directly here.
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    expect(hashes).toContain(similar.hash);
    expect(hashes).not.toContain(seed.hash);
    expect(hashes).not.toContain(unrelated.hash);
    expect(data.posts[0].score).toBeGreaterThan(0);
  });

  it('feed reflects new favorites immediately', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    // Build an empty feed first
    const before = await fetchFeed();
    expect(before.posts).toEqual([]);

    await favorite(seed.hash);
    const after = await fetchFeed();
    expect(after.posts.map((p: { hash: string }) => p.hash)).toContain(similar.hash);
  });

  it('dismissed posts never appear in the feed', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    await favorite(seed.hash);
    await dismiss(similar.hash);

    const data = await fetchFeed();
    expect(data.posts.map((p: { hash: string }) => p.hash)).not.toContain(similar.hash);
  });

  it('excludes group siblings of seeds', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const sibling = await createPostWithTags(prisma, TASTE_TAGS);
    const outsider = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'feed-test-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: seed.id, groupId: group.id, position: 0 },
        { postId: sibling.id, groupId: group.id, position: 1 },
      ],
    });

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    expect(hashes).not.toContain(sibling.hash);
    expect(hashes).toContain(outsider.hash);
  });

  it('collapses group siblings among candidates to one representative', async () => {
    const prisma = getTestPrisma();
    const a = await createPostWithTags(prisma, TASTE_TAGS); // favorite / seed
    const b = await createPostWithTags(prisma, TASTE_TAGS); // group member
    const c = await createPostWithTags(prisma, TASTE_TAGS); // group sibling of b
    const control = await createPostWithTags(prisma, TASTE_TAGS); // ungrouped
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    // B and C form a group that does NOT include the seed A, so neither is
    // excluded as a seed's group sibling — both reach the candidate list and
    // the feed's per-group dedup must keep exactly one of them.
    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'feed-dedup-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: b.id, groupId: group.id, position: 0 },
        { postId: c.id, groupId: group.id, position: 1 },
      ],
    });

    await favorite(a.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    const survivingSiblings = [b.hash, c.hash].filter((h) => hashes.includes(h));
    expect(survivingSiblings).toHaveLength(1); // one group representative only
    expect(hashes).toContain(control.hash); // ungrouped taste-sharing post kept
    expect(hashes).not.toContain(a.hash); // never the favorite itself
  });

  describe('feed cache regression behavior', () => {
    it('serves subsequent pages in the same seed bucket without DB statements', async () => {
      const { similar } = await seedCacheableFeed(['bucket cache taste', 'bucket cache style'], 2);

      const first = await captureFeedFetch('http://localhost/api/feed?page=1&limit=1');
      expect(first.count).toBeGreaterThan(0);
      expect(first.result.totalCount).toBe(similar.length);
      expect(first.result.posts).toHaveLength(1);

      const second = await captureFeedFetch('http://localhost/api/feed?page=2&limit=1');
      expect(second.count).toBe(0);
      expect(second.result.totalCount).toBe(similar.length);
      expect(second.result.posts).toHaveLength(1);

      const third = await captureFeedFetch('http://localhost/api/feed?page=1&limit=1');
      expect(third.count).toBe(0);
      expect(third.result).toEqual(first.result);
    });

    it('rebuilds the cached feed after a favorite mutation route', async () => {
      const prisma = getTestPrisma();
      const firstCluster = await createTasteCluster(['favorite cache taste a', 'favorite cache style a']);
      const secondCluster = await createTasteCluster(['favorite cache taste b', 'favorite cache style b']);
      await createPostWithTags(prisma, ['favorite cache unrelated']);
      await recalculateTagStats();

      await favorite(firstCluster.seed.hash);
      const warm = await fetchFeed('http://localhost/api/feed?limit=10');
      expect(feedHashes(warm)).toContain(firstCluster.similar[0].hash);
      expect(feedHashes(warm)).not.toContain(secondCluster.similar[0].hash);

      await favorite(secondCluster.seed.hash);
      const rebuilt = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(rebuilt.count).toBeGreaterThan(0);
      expect(feedHashes(rebuilt.result)).toContain(secondCluster.similar[0].hash);
      expect(feedHashes(rebuilt.result)).not.toContain(secondCluster.seed.hash);
    });

    it('rebuilds the cached feed after a dismissal mutation route', async () => {
      const { similar } = await seedCacheableFeed(['dismissal cache taste', 'dismissal cache style'], 1);

      const warm = await fetchFeed('http://localhost/api/feed?limit=10');
      expect(feedHashes(warm)).toContain(similar[0].hash);

      await dismiss(similar[0].hash);
      const rebuilt = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(rebuilt.count).toBeGreaterThan(0);
      expect(feedHashes(rebuilt.result)).not.toContain(similar[0].hash);
    });

    it('keeps the cached feed warm after recording a view route', async () => {
      const { similar } = await seedCacheableFeed(['view cache taste', 'view cache style'], 2);
      const warm = await fetchFeed('http://localhost/api/feed?limit=10');

      await view(similar[0].hash);
      const afterView = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(afterView.count).toBe(0);
      expect(afterView.result).toEqual(warm);
    });

    it('coalesces concurrent feed requests in the same seed bucket onto one build', async () => {
      await seedCacheableFeed(['concurrent cache taste', 'concurrent cache style'], 2);
      const url = 'http://localhost/api/feed?limit=10';

      const firstColdBuild = await captureFeedFetch(url);
      expect(firstColdBuild.count).toBeGreaterThan(0);

      invalidateFeedCache();
      const singleBuild = await captureFeedFetch(url);
      expect(singleBuild.count).toBeGreaterThan(0);

      invalidateFeedCache();
      const concurrent = await captureCountedStatements(() =>
        Promise.all(Array.from({ length: 5 }, () => fetchFeed(url)))
      );

      expect(concurrent.count).toBe(singleBuild.count);
      const firstConcurrentResponse = concurrent.result[0];
      expect(feedHashes(firstConcurrentResponse)).toEqual(feedHashes(singleBuild.result));
      for (const response of concurrent.result) {
        expect(response).toEqual(firstConcurrentResponse);
      }
    });
  });
});
