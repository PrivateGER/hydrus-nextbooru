import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestPrisma,
  recalculateTagStats,
} from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import {
  PERF_EMBEDDING_CONFIG,
  getRandomTagNames,
  seedEmbeddings,
  seedLargeDataset,
} from '../perf/seeders';
import {
  startQueryCapture,
  stopQueryCapture,
  countableStatements,
} from './query-capture';
// The admin OCR route guards on verifyAdminSession before touching the DB;
// stub it authorized so the handler's queries actually run. Safe as a
// whole-module mock: none of the other routes below import from @/lib/auth.
vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));
// Route handlers are imported statically: @/lib/db's `prisma` is a per-access
// Proxy that resolves the injected test client, and these route modules do no
// top-level DB work, so importing them before setupTestDatabase() runs is safe
// — the pool is instrumented during setup, before any test executes.
import { GET as postsSearchGET } from '@/app/api/posts/search/route';
import { GET as tagsSearchGET } from '@/app/api/tags/search/route';
import { GET as postDetailGET } from '@/app/api/posts/[hash]/route';
import { GET as recommendationsGET } from '@/app/api/recommendations/[hash]/route';
import { GET as feedGET } from '@/app/api/feed/route';
import { PUT as favoritePUT, DELETE as favoriteDELETE } from '@/app/api/posts/[hash]/favorite/route';
import { PUT as dismissalPUT, DELETE as dismissalDELETE } from '@/app/api/posts/[hash]/dismissal/route';
import { GET as ocrAdminGET } from '@/app/api/admin/ocr/route';

/**
 * Query-count budgets (N+1 guards).
 *
 * Each budget pins how many SQL statements a cold request is allowed to
 * execute. The numbers are the currently observed counts — they are a
 * ratchet, not an aspiration. If a change introduces per-row queries
 * (N+1) the count jumps well past the budget and fails deterministically,
 * independent of runner speed.
 *
 * If you lower a count, lower the budget here too. If you must raise one,
 * justify it in the PR — that is the point of the guard.
 */
const QUERY_BUDGETS = {
  // +1 vs the pre-favorites baseline of 2: the posts-search route now merges
  // favorite state (mergeFavoritedState -> getFavoritedPostIdSet, one indexed
  // lookup) after the search itself.
  postsSearchSingleTag: 3,
  postsSearchTwoTags: 3,
  tagAutocomplete: 2,
  tagCoOccurrence: 2,
  // One findUnique whose nested include tree Prisma loads as constant queries
  // (post, tags->tag, notes->translation, groups->group->posts). Constant in
  // row count — not an N+1. NB: 12 is the observed count and is unrelated to
  // this PR (post detail queries no favorite state); the prior 11 predates the
  // current guard calibration.
  postDetail: 12,
  recommendationsCold: 5,
  // This budget measures the fixture below: FEED_GUARD_SEEDS favorites (<
  // recentSeedCount, so every favorite is a seed with no sampling), NO
  // dismissals/views seeded, and no explicit embedding settings. The feed still
  // resolves a default embedding config, so the embedding path is exercised as
  // one 3-seed kNN chunk plus the batched embedding-availability read; the
  // PERF embeddings seeded in beforeAll do not match that default config, so
  // this base fixture has no embedding neighbors. The remaining query count is
  // constant in seed count: fixed signal reads + signal group memberships +
  // seed group-siblings + default embedding-config resolution + a SINGLE
  // batched tag-IDF compute for ALL seeds (getTagNeighborhoodsForSeeds: cache
  // read + one set-based compute + one post-detail fetch; the cache-write runs
  // in an interactive transaction the pool-level capture does not observe).
  // A non-empty merged list then costs TWO extra batched `postId IN (...)`
  // lookups (postGroup for per-group feed dedup + postView for the already-seen
  // penalty — single indexed batches, not N+1s). The budget is a loose ceiling:
  // batching left the real count on this path well under it.
  feed: 21,
  // Embedding-configured feed with 17 seeds (> one 16-seed chunk): the
  // embedding neighborhood phase should add a small constant number of
  // statements (two k-NN chunks + one availability read), not one query per
  // seed.
  feedWithEmbeddings: 26,
  // resolvePostForMutation's getPostIdByHash is the only pool-captured query
  // for PUT: setFavorite/setDismissal run in an interactive transaction whose
  // statements (advisory lock, delete-opposite, upsert-self) run on a
  // checked-out client the pool-level capture does not observe. DELETE is not
  // transactional, so its deleteMany is captured — 2 (lookup + delete).
  favoritePut: 1,
  favoriteDelete: 2,
  dismissalPut: 1,
  dismissalDelete: 2,
  // getOcrAdminStatus fans out to a fixed Promise.all of five aggregates
  // (three post.count by ocrStatus, imageTextRegion.count, ocrBatchState
  // .findFirst) — constant in row count, so this is a plain N+1 tripwire.
  ocrAdminStatus: 5,
} as const;

// Fixed favorite count for the feed guard: small and < recentSeedCount so the
// build fans out deterministically over exactly this many seeds.
const FEED_GUARD_SEEDS = 3;
const FEED_EMBEDDING_GUARD_SEEDS = 17;

// Rate limits are disabled for this suite via DISABLE_RATE_LIMITS in
// vitest.guards.config.ts.
function apiRequest(url: string): NextRequest {
  return new NextRequest(url);
}

/** Run a request cold (caches cleared) and count its SQL statements. */
async function countQueries(label: string, fn: () => Promise<unknown>): Promise<number> {
  invalidateAllCaches();
  startQueryCapture();
  try {
    await fn();
  } catch (err) {
    stopQueryCapture();
    throw err;
  }
  const count = countableStatements(stopQueryCapture()).length;
  console.log(`query count [${label}]: ${count}`);
  return count;
}

function hashParams(hash: string): { params: Promise<{ hash: string }> } {
  return { params: Promise.resolve({ hash }) };
}

describe('Query count guards', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Small dataset: query counts are size-independent (that is the point),
    // but rows must exist so N+1 patterns actually multiply.
    await seedLargeDataset(prisma, { posts: 300, uniqueTags: 150, tagsPerPost: 8 });
    await recalculateTagStats();
    await seedEmbeddings(prisma, { config: PERF_EMBEDDING_CONFIG });
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('posts search with a single tag stays within budget', async () => {
    const prisma = getTestPrisma();
    const [tag] = await getRandomTagNames(prisma, 1, 5);

    const count = await countQueries('posts search, 1 tag', () =>
      postsSearchGET(apiRequest(`http://localhost/api/posts/search?tags=${encodeURIComponent(tag)}`))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.postsSearchSingleTag);
  });

  it('posts search with two tags stays within budget', async () => {
    const prisma = getTestPrisma();
    const tags = await getRandomTagNames(prisma, 2, 5);
    const tagsParam = tags.map((t) => encodeURIComponent(t)).join(',');

    const count = await countQueries('posts search, 2 tags', () =>
      postsSearchGET(apiRequest(`http://localhost/api/posts/search?tags=${tagsParam}`))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.postsSearchTwoTags);
  });

  it('tag autocomplete stays within budget', async () => {
    const count = await countQueries('tag autocomplete', () =>
      tagsSearchGET(apiRequest('http://localhost/api/tags/search?q=general'))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.tagAutocomplete);
  });

  it('co-occurrence tag search stays within budget', async () => {
    const prisma = getTestPrisma();
    const [selected] = await getRandomTagNames(prisma, 1, 5);

    const count = await countQueries('tag co-occurrence', () =>
      tagsSearchGET(
        apiRequest(`http://localhost/api/tags/search?q=tag&selected=${encodeURIComponent(selected)}`)
      )
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.tagCoOccurrence);
  });

  it('post detail stays within budget regardless of tag count', async () => {
    const prisma = getTestPrisma();
    // Pick the post with the most tags: an N+1 over tags multiplies hardest here.
    const post = await prisma.post.findFirstOrThrow({
      orderBy: { tags: { _count: 'desc' } },
      select: { hash: true },
    });

    const count = await countQueries('post detail', () =>
      postDetailGET(apiRequest(`http://localhost/api/posts/${post.hash}`), hashParams(post.hash))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.postDetail);
  });

  it('cold recommendations computation stays within budget', async () => {
    const prisma = getTestPrisma();
    const post = await prisma.post.findFirstOrThrow({
      orderBy: { tags: { _count: 'desc' } },
      select: { hash: true },
    });

    const count = await countQueries('recommendations (cold)', () =>
      recommendationsGET(
        apiRequest(`http://localhost/api/recommendations/${post.hash}`),
        hashParams(post.hash)
      )
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.recommendationsCold);
  });

  it('feed build stays within budget for a fixed seed count', async () => {
    const prisma = getTestPrisma();

    // Deterministic slice: clear preference + cached-recommendation state, then
    // seed exactly FEED_GUARD_SEEDS favorites so buildFeed genuinely fans out
    // (an empty favorites set early-returns after a single query).
    const seeds = await prisma.post.findMany({
      orderBy: { id: 'asc' },
      take: FEED_GUARD_SEEDS,
      select: { id: true },
    });
    const seedIds = seeds.map((s) => s.id);
    await prisma.favorite.deleteMany();
    await prisma.feedDismissal.deleteMany();
    await prisma.postRecommendation.deleteMany({ where: { postId: { in: seedIds } } });
    await prisma.favorite.createMany({ data: seedIds.map((postId) => ({ postId })) });

    const count = await countQueries('feed (cold)', () =>
      feedGET(apiRequest('http://localhost/api/feed'))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.feed);
  });

  it('feed build with embeddings stays within chunked budget for more than one chunk', async () => {
    const prisma = getTestPrisma();
    const seeds = await prisma.post.findMany({
      orderBy: { id: 'asc' },
      take: FEED_EMBEDDING_GUARD_SEEDS,
      select: { id: true },
    });
    const seedIds = seeds.map((s) => s.id);

    await prisma.favorite.deleteMany();
    await prisma.feedDismissal.deleteMany();
    await prisma.postRecommendation.deleteMany({ where: { postId: { in: seedIds } } });
    await prisma.settings.deleteMany({
      where: {
        key: {
          in: [
            'openrouter.baseUrl',
            'openrouter.embedding.model',
            'openrouter.embedding.dimensions',
            'openrouter.embedding.imageMaxResolution',
          ],
        },
      },
    });
    await prisma.settings.createMany({
      data: [
        { key: 'openrouter.baseUrl', value: PERF_EMBEDDING_CONFIG.baseUrl },
        { key: 'openrouter.embedding.model', value: PERF_EMBEDDING_CONFIG.model },
        { key: 'openrouter.embedding.dimensions', value: String(PERF_EMBEDDING_CONFIG.dimensions) },
        {
          key: 'openrouter.embedding.imageMaxResolution',
          value: String(PERF_EMBEDDING_CONFIG.imageMaxResolution),
        },
      ],
    });
    await prisma.favorite.createMany({ data: seedIds.map((postId) => ({ postId })) });

    const count = await countQueries('feed (cold, embeddings)', () =>
      feedGET(apiRequest('http://localhost/api/feed'))
    );

    expect(seedIds).toHaveLength(17);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.feedWithEmbeddings);
  });

  it('favorite PUT stays within budget', async () => {
    const prisma = getTestPrisma();
    const post = await prisma.post.findFirstOrThrow({ select: { hash: true } });

    const count = await countQueries('favorite PUT', () =>
      favoritePUT(apiRequest(`http://localhost/api/posts/${post.hash}/favorite`), hashParams(post.hash))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.favoritePut);
  });

  it('favorite DELETE stays within budget', async () => {
    const prisma = getTestPrisma();
    const post = await prisma.post.findFirstOrThrow({ select: { hash: true } });

    const count = await countQueries('favorite DELETE', () =>
      favoriteDELETE(apiRequest(`http://localhost/api/posts/${post.hash}/favorite`), hashParams(post.hash))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.favoriteDelete);
  });

  it('dismissal PUT stays within budget', async () => {
    const prisma = getTestPrisma();
    const post = await prisma.post.findFirstOrThrow({ select: { hash: true } });

    const count = await countQueries('dismissal PUT', () =>
      dismissalPUT(apiRequest(`http://localhost/api/posts/${post.hash}/dismissal`), hashParams(post.hash))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.dismissalPut);
  });

  it('dismissal DELETE stays within budget', async () => {
    const prisma = getTestPrisma();
    const post = await prisma.post.findFirstOrThrow({ select: { hash: true } });

    const count = await countQueries('dismissal DELETE', () =>
      dismissalDELETE(apiRequest(`http://localhost/api/posts/${post.hash}/dismissal`), hashParams(post.hash))
    );

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.dismissalDelete);
  });

  it('admin OCR status stays within budget', async () => {
    const count = await countQueries('admin OCR status', () => ocrAdminGET());

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(QUERY_BUDGETS.ocrAdminStatus);
  });
});
