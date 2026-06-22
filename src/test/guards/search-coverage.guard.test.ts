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
import { seedLargeDataset, seedNotes, getRandomTagNames } from '../perf/seeders';
import { createPost, createNote, createGroup, createPostInGroup, createTag } from '../integration/factories';
import { SourceType, TagCategory } from '@/generated/prisma/client';
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
 * Plan guards for read paths the original suite missed: the groups creator
 * filter, the posts-search notes filter, and the selected-tag tree. Same
 * capture + EXPLAIN technique as query-plans.guard.test.ts; dataset sized so
 * index access is decisively optimal.
 */

/** Low-frequency token planted in one note for the notes filter. */
const NOTE_MARKER_TOKEN = 'zqxmarkernotetoken';
/** Low-frequency substring shared by the seeded artist tags. */
const ARTIST_MARKER = 'grpcreatormarker';

let tagsTreeGET: typeof import('@/app/api/tags/tree/route').GET;
let searchPosts: typeof import('@/lib/search').searchPosts;
let searchGroups: typeof import('@/lib/groups').searchGroups;

function apiRequest(url: string): NextRequest {
  return new NextRequest(url);
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
 * EXPLAIN every captured SELECT touching `relation`, re-running with the
 * original bind values so the planner reproduces the app's custom plan.
 */
async function explainSelectsTouching(
  captured: CapturedQuery[],
  relation: string
): Promise<ExplainedQuery[]> {
  const prisma = getTestPrisma();
  const seen = new Set<string>();
  const explained: ExplainedQuery[] = [];

  for (const query of selectStatements(captured)) {
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

function expectNoSeqScanOn(explained: ExplainedQuery[], relations: string[]): void {
  expect(explained.length, 'no queries captured — path likely errored').toBeGreaterThan(0);

  for (const { text, explain } of explained) {
    const offenders = seqScannedRelations(explain).filter((r) => relations.includes(r));
    expect(
      offenders,
      `Sequential scan on ${offenders.join(', ')} in query:\n${text}`
    ).toEqual([]);
  }
}

describe('Search coverage plan guards', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedLargeDataset(prisma, { posts: 20_000, uniqueTags: 10_000, tagsPerPost: 12 });

    // Notes plus one marker note with a token rare enough that GIN is optimal.
    await seedNotes(prisma);
    const markerPost = await createPost(prisma);
    await createNote(prisma, markerPost.id, {
      name: 'marker note',
      content: `a planted ${NOTE_MARKER_TOKEN} for the notes filter guard`,
    });

    // Groups whose first post carries a trigram-selective ARTIST tag.
    for (let i = 0; i < 5; i++) {
      const artist = await createTag(prisma, `${ARTIST_MARKER}_${i}`, TagCategory.ARTIST);
      const group = await createGroup(prisma, SourceType.PIXIV, `creator-marker-group-${i}`);
      const first = await createPostInGroup(prisma, group, 0);
      await createPostInGroup(prisma, group, 1);
      await prisma.postTag.create({ data: { postId: first.id, tagId: artist.id } });
    }

    await recalculateTagStats();
    await prisma.$executeRawUnsafe('ANALYZE');

    tagsTreeGET = (await import('@/app/api/tags/tree/route')).GET;
    searchPosts = (await import('@/lib/search')).searchPosts;
    searchGroups = (await import('@/lib/groups')).searchGroups;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('groups creator filter drives the artist match from the Tag name trigram index', async () => {
    const captured = await captureQueries(() =>
      searchGroups({ creatorFilter: ARTIST_MARKER, order: 'oldest' }, getTestPrisma())
    );

    const explained = await explainSelectsTouching(captured, 'Tag');
    expect(explained.length, 'no Tag-touching query captured — filter shape changed').toBeGreaterThan(0);

    // A correlated EXISTS-under-OR (the pre-fix shape) can't use this index.
    const usedIndexes = explained.flatMap(({ explain }) => indexesUsed(explain));
    expect(usedIndexes).toContain('Tag_name_trgm_idx');
  });

  it('posts-search notes filter reaches Note through the tsvector index', async () => {
    invalidateAllCaches();

    const captured = await captureQueries(() =>
      searchPosts([], 1, { notesQuery: NOTE_MARKER_TOKEN })
    );

    // Inline to_tsvector() (the old bug) would seq-scan Note here.
    expectNoSeqScanOn(await explainSelectsTouching(captured, 'Note'), ['Note']);
  });

  it('selected-tag tree resolves posts through the PostTag (tagId, postId) index', async () => {
    invalidateAllCaches();
    const prisma = getTestPrisma();
    const [selected] = await getRandomTagNames(prisma, 1, 10, 500);

    const captured = await captureQueries(() =>
      tagsTreeGET(apiRequest(`http://localhost/api/tags/tree?selected=${encodeURIComponent(selected)}`))
    );

    const explained = await explainSelectsTouching(captured, 'PostTag');
    expect(explained.length, 'no PostTag-touching query captured — route likely errored').toBeGreaterThan(0);

    const usedIndexes = explained.flatMap(({ explain }) => indexesUsed(explain));
    expect(usedIndexes).toContain('PostTag_tagId_postId_idx');
  });
});
