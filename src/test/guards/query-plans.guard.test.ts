import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedLargeDataset, getRandomTagNames } from '../perf/seeders';
import { getPostsByHashRotation } from '@/lib/random-order';
import {
  startQueryCapture,
  stopQueryCapture,
  selectStatements,
  type CapturedQuery,
} from './query-capture';
import {
  parseExplainRows,
  seqScannedRelations,
  indexesUsed,
  type ExplainJson,
} from './plan-utils';

/**
 * Query-plan regression guards.
 *
 * Instead of asserting wall-clock thresholds (meaningless on shared CI
 * runners), these tests capture the exact SQL each hot path executes,
 * re-run it under EXPLAIN (FORMAT JSON), and assert structural properties:
 * large relations must be reached through an index, never a sequential scan.
 * A migration or query change that knocks out an index path fails loudly
 * and deterministically.
 *
 * The dataset is sized so that index access is unambiguously optimal for
 * the asserted relations (planner stats refreshed via ANALYZE after seeding).
 */

let postsSearchGET: typeof import('@/app/api/posts/search/route').GET;
let tagsSearchGET: typeof import('@/app/api/tags/search/route').GET;

let requestCounter = 0;

/** Unique client IP per request so in-memory rate limiting never interferes. */
function apiRequest(url: string): NextRequest {
  requestCounter += 1;
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': `plan-guard-${requestCounter}` },
  });
}

async function captureQueries(fn: () => Promise<unknown>): Promise<CapturedQuery[]> {
  startQueryCapture();
  try {
    await fn();
  } catch (err) {
    stopQueryCapture();
    throw err;
  }
  return stopQueryCapture();
}

interface ExplainedQuery {
  text: string;
  explain: ExplainJson;
}

/**
 * EXPLAIN every captured SELECT that touches the given relation.
 * Re-executes with the original parameter values so the planner produces
 * the same custom plan the application got.
 */
async function explainSelectsTouching(
  captured: CapturedQuery[],
  relation: string
): Promise<ExplainedQuery[]> {
  const prisma = getTestPrisma();
  const seen = new Set<string>();
  const explained: ExplainedQuery[] = [];

  for (const query of selectStatements(captured)) {
    // Key on text AND values: the same statement with different bind values
    // can produce different custom plans, so each distinct execution counts.
    const key = `${query.text}|${JSON.stringify(query.values)}`;
    if (!query.text.includes(`"${relation}"`) || seen.has(key)) continue;
    seen.add(key);

    const rows = await prisma.$queryRawUnsafe(
      `EXPLAIN (FORMAT JSON) ${query.text}`,
      ...(query.values as unknown[])
    );
    explained.push({ text: query.text, explain: parseExplainRows(rows) });
  }

  return explained;
}

/**
 * Assert none of the explained queries sequentially scans the given
 * relations. Also guards against vacuous passes: at least one query must
 * have been captured and explained.
 */
function expectNoSeqScanOn(explained: ExplainedQuery[], relations: string[]): void {
  expect(explained.length, 'no queries captured — route likely errored').toBeGreaterThan(0);

  for (const { text, explain } of explained) {
    const offenders = seqScannedRelations(explain).filter((r) => relations.includes(r));
    expect(
      offenders,
      `Sequential scan on ${offenders.join(', ')} in query:\n${text}`
    ).toEqual([]);
  }
}

describe('Query plan guards', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    // Sized so index access is decisively optimal, not borderline: 10k tags
    // make selective trigram lookups beat scanning Tag, and 20k posts
    // (~240k PostTag rows) put co-occurrence joins firmly in index-scan
    // territory. With fewer rows the seq-scan/index cost crossover sits
    // close enough that ANALYZE sampling noise can flip plans between runs.
    await seedLargeDataset(prisma, { posts: 20_000, uniqueTags: 10_000, tagsPerPost: 12 });
    await prisma.$executeRawUnsafe('ANALYZE');

    postsSearchGET = (await import('@/app/api/posts/search/route')).GET;
    tagsSearchGET = (await import('@/app/api/tags/search/route')).GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('detects sequential scans end-to-end (pipeline self-check)', async () => {
    // Post.width has no index, so this MUST report a seq scan. If it does
    // not, the EXPLAIN pipeline is broken and every other guard is vacuous.
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe(
      'EXPLAIN (FORMAT JSON) SELECT id FROM "Post" WHERE width = $1',
      123456789
    );
    expect(seqScannedRelations(parseExplainRows(rows))).toContain('Post');
  });

  it('single-tag post search reaches PostTag and Post through indexes', async () => {
    const prisma = getTestPrisma();
    const [tag] = await getRandomTagNames(prisma, 1, 10, 500);

    const captured = await captureQueries(() =>
      postsSearchGET(apiRequest(`http://localhost/api/posts/search?tags=${encodeURIComponent(tag)}`))
    );

    expectNoSeqScanOn(await explainSelectsTouching(captured, 'PostTag'), ['PostTag', 'Post']);
  });

  it('multi-tag AND post search reaches PostTag and Post through indexes', async () => {
    const prisma = getTestPrisma();
    const tags = await getRandomTagNames(prisma, 2, 10, 500);
    const tagsParam = tags.map((t) => encodeURIComponent(t)).join(',');

    const captured = await captureQueries(() =>
      postsSearchGET(apiRequest(`http://localhost/api/posts/search?tags=${tagsParam}`))
    );

    expectNoSeqScanOn(await explainSelectsTouching(captured, 'PostTag'), ['PostTag', 'Post']);
  });

  it('tag autocomplete with a selective pattern avoids scanning the Tag table', async () => {
    // 'meta_tag_1' matches ~11 of 10k tags; the trigram index must be used.
    const captured = await captureQueries(() =>
      tagsSearchGET(apiRequest('http://localhost/api/tags/search?q=meta_tag_1'))
    );

    expectNoSeqScanOn(await explainSelectsTouching(captured, 'Tag'), ['Tag']);
  });

  it('co-occurrence tag search uses the PostTag (tagId, postId) index', async () => {
    // "No seq scan" is NOT an invariant here: a broad autocomplete pattern
    // can match Zipf-head tags covering most of PostTag, where a hash join
    // over a seq scan is genuinely optimal and the planner flip-flops at
    // the margin. What IS invariant: resolving the selected tag's posts
    // must go through the (tagId, postId) index — dropping that index is
    // the regression this guard exists to catch.
    const prisma = getTestPrisma();
    const [selected] = await getRandomTagNames(prisma, 1, 10, 500);

    const captured = await captureQueries(() =>
      tagsSearchGET(
        apiRequest(
          `http://localhost/api/tags/search?q=meta&selected=${encodeURIComponent(selected)}`
        )
      )
    );

    const explained = await explainSelectsTouching(captured, 'PostTag');
    expect(explained.length, 'no queries captured — route likely errored').toBeGreaterThan(0);

    const usedIndexes = explained.flatMap(({ explain }) => indexesUsed(explain));
    expect(usedIndexes).toContain('PostTag_tagId_postId_idx');
  });

  it('random-order browsing walks the Post hash index', async () => {
    const prisma = getTestPrisma();

    const captured = await captureQueries(() =>
      getPostsByHashRotation({ page: 3, pageSize: 48, seed: 'plan-guard', prisma })
    );

    expectNoSeqScanOn(await explainSelectsTouching(captured, 'Post'), ['Post']);
  });
});
