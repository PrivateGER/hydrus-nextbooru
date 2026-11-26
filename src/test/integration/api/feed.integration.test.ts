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
import { buildFeed, FEED_CONFIG, invalidateFeedCache, clearFeedCache, settleFeedRebuild, feedRebuildInFlight, warmFeedCache } from '@/lib/feed';
import { startQueryCapture, stopQueryCapture, countableStatements } from '@/test/guards/query-capture';
import { upsertCompleteEmbedding } from '@/lib/embeddings/store';

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

  it('interleaves embedding taste clusters and applies favorite, sibling, and dismissal exclusions', async () => {
    const prisma = getTestPrisma();
    const dimensions = 768;
    const embeddingConfig = {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-embedding-2-preview',
      dimensions,
      imageMaxResolution: 1024,
    };
    const zeroTail = Array.from({ length: dimensions - 2 }, () => 0);
    const favoriteA = await createPostWithTags(prisma, ['cluster a favorite']);
    const favoriteB = await createPostWithTags(prisma, ['cluster b favorite']);
    const sibling = await createPostWithTags(prisma, ['favorite sibling']);
    const candidatesA = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createPostWithTags(prisma, [`cluster a candidate ${index}`])
      )
    );
    const candidatesB = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createPostWithTags(prisma, [`cluster b candidate ${index}`])
      )
    );
    const dismissed = await createPostWithTags(prisma, ['cluster a dismissal']);
    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'embedding-favorite-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: favoriteA.id, groupId: group.id, position: 0 },
        { postId: sibling.id, groupId: group.id, position: 1 },
      ],
    });
    const rows: Array<[number, number[]]> = [
      [favoriteA.id, [1, 0, ...zeroTail]],
      [favoriteB.id, [0, 1, ...zeroTail]],
      [sibling.id, [1, 0.001, ...zeroTail]],
      [dismissed.id, [1, 0, ...zeroTail]],
      ...candidatesA.map(
        (post, index): [number, number[]] => [
          post.id,
          [1, (index + 1) / 100, ...zeroTail],
        ]
      ),
      ...candidatesB.map(
        (post, index): [number, number[]] => [
          post.id,
          [(index + 1) / 100, 1, ...zeroTail],
        ]
      ),
    ];
    for (const [postId, embedding] of rows) {
      await upsertCompleteEmbedding({
        postId,
        config: embeddingConfig,
        embedding,
        sourceWidth: 100,
        sourceHeight: 100,
        processedWidth: 100,
        processedHeight: 100,
      });
    }
    await prisma.settings.createMany({
      data: [
        { key: 'openrouter.apiKey', value: 'sk-or-v1-test' },
        { key: 'openrouter.embedding.model', value: embeddingConfig.model },
        { key: 'openrouter.embedding.dimensions', value: String(dimensions) },
        {
          key: 'openrouter.embedding.imageMaxResolution',
          value: String(embeddingConfig.imageMaxResolution),
        },
      ],
    });
    await favorite(favoriteA.hash);
    await favorite(favoriteB.hash);
    clearFeedCache();
    const clusterConfig = {
      ...FEED_CONFIG,
      clusterCount: 2,
      minClusterSize: 1,
      neighborsPerCluster: 20,
      pageSize: 8,
      pageCount: 1,
      maxFeedSize: 8,
    };
    const interleaved = await buildFeed(clusterConfig);
    const clusterAHashes = new Set(candidatesA.map((post) => post.hash));
    const clusterBHashes = new Set(candidatesB.map((post) => post.hash));

    expect(interleaved.slice(0, 4).some((post) => clusterAHashes.has(post.hash))).toBe(true);
    expect(interleaved.slice(0, 4).some((post) => clusterBHashes.has(post.hash))).toBe(true);
    expect(interleaved.map((post) => post.hash)).not.toContain(favoriteA.hash);
    expect(interleaved.map((post) => post.hash)).not.toContain(favoriteB.hash);
    expect(interleaved.map((post) => post.hash)).not.toContain(sibling.hash);

    await dismiss(dismissed.hash);
    const filtered = await buildFeed(clusterConfig);
    expect(filtered.some((post) => clusterAHashes.has(post.hash))).toBe(false);
    expect(filtered.some((post) => clusterBHashes.has(post.hash))).toBe(true);
  });

  it('favorites retrieval reaches an outlying favorite\'s neighbors that the centroid scan misses', async () => {
    const prisma = getTestPrisma();
    const dimensions = 768;
    const embeddingConfig = {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-embedding-2-preview',
      dimensions,
      imageMaxResolution: 1024,
    };
    const zeroTail = Array.from({ length: dimensions - 2 }, () => 0);
    const coreFavorites = await Promise.all(
      [0, 0.02, -0.02].map((offset) =>
        createPostWithTags(prisma, [`core favorite ${offset}`]).then(
          (post) => [post, [1, offset, ...zeroTail]] as const
        )
      )
    );
    const coreCandidates = await Promise.all(
      [1, 2, 3, 4].map((step) =>
        createPostWithTags(prisma, [`core candidate ${step}`]).then(
          (post) => [post, [1, step / 100, ...zeroTail]] as const
        )
      )
    );
    // One favorite far from the other three, with one close neighbor and one
    // group sibling. A single cluster's centroid sits with the core.
    const outlierFavorite = await createPostWithTags(prisma, ['outlier favorite']);
    const outlierCandidate = await createPostWithTags(prisma, ['outlier candidate']);
    const outlierSibling = await createPostWithTags(prisma, ['outlier sibling']);
    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'outlier-favorite-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: outlierFavorite.id, groupId: group.id, position: 0 },
        { postId: outlierSibling.id, groupId: group.id, position: 1 },
      ],
    });
    const rows: Array<readonly [Post, number[]]> = [
      ...coreFavorites,
      ...coreCandidates,
      [outlierFavorite, [0.5, 0.866, ...zeroTail]],
      [outlierCandidate, [0.5, 0.87, ...zeroTail]],
      [outlierSibling, [0.5, 0.86, ...zeroTail]],
    ];
    for (const [post, embedding] of rows) {
      await upsertCompleteEmbedding({
        postId: post.id,
        config: embeddingConfig,
        embedding,
        sourceWidth: 100,
        sourceHeight: 100,
        processedWidth: 100,
        processedHeight: 100,
      });
    }
    await prisma.settings.createMany({
      data: [
        { key: 'openrouter.apiKey', value: 'sk-or-v1-test' },
        { key: 'openrouter.embedding.model', value: embeddingConfig.model },
        { key: 'openrouter.embedding.dimensions', value: String(dimensions) },
        {
          key: 'openrouter.embedding.imageMaxResolution',
          value: String(embeddingConfig.imageMaxResolution),
        },
      ],
    });
    for (const [post] of coreFavorites) await favorite(post.hash);
    await favorite(outlierFavorite.hash);

    const oneCluster = {
      ...FEED_CONFIG,
      clusterCount: 1,
      minClusterSize: 1,
      // Enough for the core (3 favorites + 4 candidates) but not the outlier.
      neighborsPerCluster: 6,
      pageSize: 8,
      pageCount: 1,
      maxFeedSize: 8,
    };
    const coreHashes = coreCandidates.map(([post]) => post.hash);

    clearFeedCache();
    const centroid = (await buildFeed({ ...oneCluster, retrieval: 'centroid' })).map((post) => post.hash);
    expect(centroid.some((hash) => coreHashes.includes(hash))).toBe(true);
    expect(centroid).not.toContain(outlierCandidate.hash);

    clearFeedCache();
    const fromFavorites = (await buildFeed({ ...oneCluster, retrieval: 'favorites' })).map((post) => post.hash);
    expect(fromFavorites).toContain(outlierCandidate.hash);
    expect(fromFavorites).toEqual(expect.arrayContaining(coreHashes));
    expect(fromFavorites).not.toContain(outlierSibling.hash);
    expect(fromFavorites).not.toContain(outlierFavorite.hash);
    for (const [post] of coreFavorites) expect(fromFavorites).not.toContain(post.hash);

    // A dismissal removes its visual near-neighbors in this mode too, and the
    // rebuild reuses the cached neighbor lists.
    await dismiss(coreCandidates[0][0].hash);
    const { result: afterDismissal, count } = await captureCountedStatements(() =>
      buildFeed({ ...oneCluster, retrieval: 'favorites' })
    );
    expect(afterDismissal.some((post) => coreHashes.includes(post.hash))).toBe(false);
    expect(afterDismissal.map((post) => post.hash)).toContain(outlierCandidate.hash);
    expect(count).toBeGreaterThan(0);
  });

  it('the variety pass moves a distinct candidate ahead of near-twins of an earlier pick', async () => {
    const prisma = getTestPrisma();
    const dimensions = 768;
    const embeddingConfig = {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-embedding-2-preview',
      dimensions,
      imageMaxResolution: 1024,
      videoEnabled: false,
    };
    const tail = Array.from({ length: dimensions - 3 }, () => 0);
    const degrees = (value: number) => (value * Math.PI) / 180;
    const embed = async (name: string, head: [number, number, number]) => {
      const post = await createPostWithTags(prisma, [name]);
      await upsertCompleteEmbedding({
        postId: post.id,
        config: embeddingConfig,
        embedding: [...head, ...tail],
        sourceWidth: 100,
        sourceHeight: 100,
        processedWidth: 100,
        processedHeight: 100,
      });
      return post;
    };
    // Three favorites around the x axis...
    const favorites = [
      await embed('favorite a', [1, 0, 0]),
      await embed('favorite b', [1, 0.04, 0]),
      await embed('favorite c', [1, -0.04, 0]),
    ];
    // ...three near-identical candidates 20 degrees off towards y, and a
    // slightly further one (22 degrees) off towards z instead.
    const twins = [
      await embed('twin 1', [Math.cos(degrees(20)), Math.sin(degrees(20)), 0]),
      await embed('twin 2', [Math.cos(degrees(20.2)), Math.sin(degrees(20.2)), 0]),
      await embed('twin 3', [Math.cos(degrees(20.4)), Math.sin(degrees(20.4)), 0]),
    ];
    const distinct = await embed('distinct', [Math.cos(degrees(22)), 0, Math.sin(degrees(22))]);
    await prisma.settings.createMany({
      data: [
        { key: 'openrouter.apiKey', value: 'sk-or-v1-test' },
        { key: 'openrouter.embedding.model', value: embeddingConfig.model },
        { key: 'openrouter.embedding.dimensions', value: String(dimensions) },
        {
          key: 'openrouter.embedding.imageMaxResolution',
          value: String(embeddingConfig.imageMaxResolution),
        },
      ],
    });
    for (const post of favorites) await favorite(post.hash);

    const oneCluster = {
      ...FEED_CONFIG,
      clusterCount: 1,
      minClusterSize: 1,
      freshnessBoost: 0,
      pageSize: 8,
      pageCount: 1,
      maxFeedSize: 8,
    };
    // Without the pass the distinct candidate ranks last by similarity to the
    // centroid; "favorites" already lifts it one place, because the favorite
    // furthest from the twins has it as its nearest neighbor.
    const relevanceOrder = {
      centroid: [twins[0].hash, twins[1].hash, twins[2].hash, distinct.hash],
      favorites: [twins[0].hash, twins[1].hash, distinct.hash, twins[2].hash],
    };
    const varietyOrder = [twins[0].hash, distinct.hash, twins[1].hash, twins[2].hash];

    for (const retrieval of ['centroid', 'favorites'] as const) {
      clearFeedCache();
      const plain = await buildFeed({ ...oneCluster, retrieval, diversityLambda: 1 });
      expect(plain.map((post) => post.hash)).toEqual(relevanceOrder[retrieval]);

      // With the pass the distinct candidate follows the first twin in both
      // modes: the other two are near-copies of a post already picked.
      // The prefix read (pgvector subvector) is one extra statement.
      clearFeedCache();
      const { result: diversified, count } = await captureCountedStatements(() =>
        buildFeed({ ...oneCluster, retrieval, diversityLambda: 0.7 })
      );
      expect(diversified.map((post) => post.hash)).toEqual(varietyOrder);
      expect(count).toBeGreaterThan(0);
    }
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

  it('excludes group siblings of every favorite in the fallback path', async () => {
    const prisma = getTestPrisma();
    const seedFav = await createPostWithTags(prisma, TASTE_TAGS);
    const oldFav = await createPostWithTags(prisma, TASTE_TAGS);
    const sibling = await createPostWithTags(prisma, TASTE_TAGS);
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

    // The fallback ranks from recent favorites, while the server-side
    // favorite relation excludes siblings of every favorite.
    const posts = await buildFeed({
      ...FEED_CONFIG,
      viewSeedCount: 0,
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

    it('serves the first read after a warm-up from cache', async () => {
      const { similar } = await seedCacheableFeed(['warmup cache taste', 'warmup cache style'], 2);
      clearFeedCache();

      warmFeedCache();
      await settleFeedRebuild();

      const first = await captureFeedFetch('http://localhost/api/feed?limit=10');
      expect(first.count).toBe(0);
      expect(feedHashes(first.result).sort()).toEqual(similar.map((post) => post.hash).sort());
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
