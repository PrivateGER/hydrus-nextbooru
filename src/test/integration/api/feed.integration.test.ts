import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Post } from '@/generated/prisma/client';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase, recalculateTagStats, recalculatePostTagNorms } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from '../factories';
// Static route imports are safe here: @/lib/db's prisma is a Proxy resolving the test client per property access, and these modules do no top-level DB work (unlike suites using vi.doMock, which need dynamic imports).
import * as feedRoute from '@/app/api/feed/route';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import * as dismissalRoute from '@/app/api/posts/[hash]/dismissal/route';
import * as viewRoute from '@/app/api/posts/[hash]/view/route';
import { buildFeed, FEED_CONFIG, invalidateFeedCache, clearFeedCache, settleFeedRebuild, feedRebuildInFlight } from '@/lib/feed';
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
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    expect(hashes).toContain(similar.hash);
    expect(hashes).not.toContain(seed.hash);
    expect(hashes).not.toContain(unrelated.hash);
    expect(data.posts[0].score).toBeGreaterThan(0);
  });

  it('reflects a new favorite after revalidation, serving the stale feed meanwhile', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

    // Build an empty feed first
    const before = await fetchFeed();
    expect(before.posts).toEqual([]);

    await favorite(seed.hash);

    // Stale-while-revalidate: the first read after the mutation returns the
    // previous (empty) ranking instantly and starts the rebuild.
    const stale = await fetchFeed();
    expect(stale.posts).toEqual([]);

    await settleFeedRebuild();
    const after = await fetchFeed();
    expect(after.posts.map((p: { hash: string }) => p.hash)).toContain(similar.hash);
  });

  it('dismissed posts never appear in the feed', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

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
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

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

  it('excludes group siblings of favorites that were not sampled as seeds', async () => {
    const prisma = getTestPrisma();
    const seedFav = await createPostWithTags(prisma, TASTE_TAGS); // newest favorite -> the only seed
    const oldFav = await createPostWithTags(prisma, TASTE_TAGS); // older favorite, NOT a seed
    const sibling = await createPostWithTags(prisma, TASTE_TAGS); // same set as oldFav
    const outsider = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'unsampled-favorite-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: oldFav.id, groupId: group.id, position: 0 },
        { postId: sibling.id, groupId: group.id, position: 1 },
      ],
    });

    await prisma.favorite.create({
      data: { postId: oldFav.id, favoritedAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    await prisma.favorite.create({
      data: { postId: seedFav.id, favoritedAt: new Date() },
    });

    // One recent seed, no sampled/view/negative strata: oldFav is a favorite
    // that is NOT a seed this build — its set sibling must still be excluded.
    const posts = await buildFeed({
      ...FEED_CONFIG,
      recentSeedCount: 1,
      sampledSeedCount: 0,
      viewSeedCount: 0,
      negativeSeedCount: 0,
    });

    const hashes = posts.map((p) => p.hash);
    expect(hashes).not.toContain(sibling.hash);
    expect(hashes).toContain(outsider.hash);
  });

  it('collapses perceptual near-duplicates (same blurhash and dimensions) to one', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const dupBlurhash = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';
    const dupA = await createPostWithTags(prisma, TASTE_TAGS, {
      blurhash: dupBlurhash, width: 1920, height: 1080,
    });
    const dupB = await createPostWithTags(prisma, TASTE_TAGS, {
      blurhash: dupBlurhash, width: 1920, height: 1080,
    });
    const distinct = await createPostWithTags(prisma, TASTE_TAGS, {
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj', width: 1920, height: 1080,
    });
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = feedHashes(data);
    const dupsServed = [dupA.hash, dupB.hash].filter((h) => hashes.includes(h));
    expect(dupsServed).toHaveLength(1);
    expect(hashes).toContain(distinct.hash);
  });

  it('collapses group siblings among candidates to one representative', async () => {
    const prisma = getTestPrisma();
    const a = await createPostWithTags(prisma, TASTE_TAGS); // favorite / seed
    const b = await createPostWithTags(prisma, TASTE_TAGS); // group member
    const c = await createPostWithTags(prisma, TASTE_TAGS); // group sibling of b
    const control = await createPostWithTags(prisma, TASTE_TAGS); // ungrouped
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });
    await recalculatePostTagNorms(); // cosine denominator derives from the forced idf

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

    it('serves the stale feed after a favorite and swaps in the rebuild', async () => {
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

      // Stale-while-revalidate: the read right after the mutation returns the
      // previous ranking and starts exactly one background rebuild.
      const { result: stale, count } = await captureCountedStatements(async () => {
        const response = await fetchFeed('http://localhost/api/feed?limit=10');
        // The non-blocking contract itself: the stale response resolved while
        // the rebuild it triggered was still live. A regression to blocking
        // reads would settle the build before the response resolves.
        expect(feedRebuildInFlight()).toBe(true);
        await settleFeedRebuild();
        return response;
      });
      expect(feedHashes(stale)).toEqual(feedHashes(warm));
      expect(count).toBeGreaterThan(0); // the rebuild ran within the capture

      const rebuilt = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(rebuilt.count).toBe(0); // swapped-in entry serves without queries
      expect(feedHashes(rebuilt.result)).toContain(secondCluster.similar[0].hash);
      expect(feedHashes(rebuilt.result)).not.toContain(secondCluster.seed.hash);
    });

    it('drops a dismissed post once revalidation lands', async () => {
      const { similar } = await seedCacheableFeed(['dismissal cache taste', 'dismissal cache style'], 1);

      const warm = await fetchFeed('http://localhost/api/feed?limit=10');
      expect(feedHashes(warm)).toContain(similar[0].hash);

      await dismiss(similar[0].hash);

      // The accepted stale-while-revalidate trade-off: the dismissed post can
      // appear once more while the rebuild runs.
      const stale = await fetchFeed('http://localhost/api/feed?limit=10');
      expect(feedHashes(stale)).toContain(similar[0].hash);

      await settleFeedRebuild();
      const rebuilt = await fetchFeed('http://localhost/api/feed?limit=10');
      expect(feedHashes(rebuilt)).not.toContain(similar[0].hash);
    });

    it('keeps the cached feed warm after recording a view route', async () => {
      const { similar } = await seedCacheableFeed(['view cache taste', 'view cache style'], 2);
      const warm = await fetchFeed('http://localhost/api/feed?limit=10');

      await view(similar[0].hash);
      const afterView = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(afterView.count).toBe(0);
      expect(afterView.result).toEqual(warm);
    });

    it('coalesces concurrent revalidations in the same seed bucket onto one build', async () => {
      await seedCacheableFeed(['concurrent cache taste', 'concurrent cache style'], 2);
      const url = 'http://localhost/api/feed?limit=10';

      const firstColdBuild = await captureFeedFetch(url);
      expect(firstColdBuild.count).toBeGreaterThan(0);

      // One read after invalidation triggers exactly one background rebuild.
      invalidateFeedCache();
      const singleBuild = await captureCountedStatements(async () => {
        await fetchFeed(url);
        await settleFeedRebuild();
      });
      expect(singleBuild.count).toBeGreaterThan(0);

      // Five concurrent reads after invalidation still trigger exactly one
      // rebuild (same statement count), all serving the identical stale feed.
      invalidateFeedCache();
      const concurrent = await captureCountedStatements(async () => {
        const responses = await Promise.all(
          Array.from({ length: 5 }, () => fetchFeed(url))
        );
        await settleFeedRebuild();
        return responses;
      });

      expect(concurrent.count).toBe(singleBuild.count);
      const firstConcurrentResponse = concurrent.result[0];
      for (const response of concurrent.result) {
        expect(response).toEqual(firstConcurrentResponse);
      }

      // After the coalesced rebuild settles, the entry serves query-free.
      const settled = await captureFeedFetch(url);
      expect(settled.count).toBe(0);
    });
  });
});
