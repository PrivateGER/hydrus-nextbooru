import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestPrisma,
  recalculateTagStats,
} from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import { seedLargeDataset, getRandomTagNames } from '../perf/seeders';
import {
  startQueryCapture,
  stopQueryCapture,
  countableStatements,
} from './query-capture';

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
  postsSearchSingleTag: 2,
  postsSearchTwoTags: 2,
  tagAutocomplete: 2,
  tagCoOccurrence: 2,
  // One findUnique whose nested include tree Prisma loads as ~10 constant
  // queries (post, tags->tag, notes->translation, groups->group->posts).
  // Constant in row count — not an N+1.
  postDetail: 10,
  recommendationsCold: 5,
} as const;

let postsSearchGET: typeof import('@/app/api/posts/search/route').GET;
let tagsSearchGET: typeof import('@/app/api/tags/search/route').GET;
let postDetailGET: typeof import('@/app/api/posts/[hash]/route').GET;
let recommendationsGET: typeof import('@/app/api/recommendations/[hash]/route').GET;

let requestCounter = 0;

function apiRequest(url: string): NextRequest {
  requestCounter += 1;
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': `count-guard-${requestCounter}` },
  });
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

    postsSearchGET = (await import('@/app/api/posts/search/route')).GET;
    tagsSearchGET = (await import('@/app/api/tags/search/route')).GET;
    postDetailGET = (await import('@/app/api/posts/[hash]/route')).GET;
    recommendationsGET = (await import('@/app/api/recommendations/[hash]/route')).GET;
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
});
