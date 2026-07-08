import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from './factories';
import { invalidateAllCaches } from '@/lib/cache';

let findSearchNeighbors: typeof import('@/lib/search').findSearchNeighbors;
let searchPosts: typeof import('@/lib/search').searchPosts;

const at = (iso: string) => new Date(iso);

describe('findSearchNeighbors (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    ({ findSearchNeighbors, searchPosts } = await import('@/lib/search'));
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
  });

  it('returns the listing-adjacent posts around the anchor', async () => {
    // Listing order is importedAt desc: c, b, a
    const a = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-01T00:00:00Z') });
    const b = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-02T00:00:00Z') });
    const c = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-03T00:00:00Z') });

    const neighbors = await findSearchNeighbors(b, ['scenery']);

    expect(neighbors).toEqual({ prevHash: c.hash, nextHash: a.hash });
  });

  it('agrees with the searchPosts listing order, including importedAt ties', async () => {
    const shared = at('2026-01-01T00:00:00Z');
    const created = [
      await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: shared }),
      await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: shared }),
      await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: shared }),
    ];

    const listing = (await searchPosts(['scenery'], 1)).posts;
    expect(listing).toHaveLength(3);

    // Anchor from the created post, NOT the listing row: searchPosts does not
    // select importedAt, and Prisma silently drops undefined comparisons —
    // an undefined anchor date would degrade the keyset to id-only and this
    // test would no longer exercise the tie-break it claims to.
    const anchor = created.find((p) => p.id === listing[1].id)!;

    // Walking neighbors from the middle post must reproduce the listing.
    const neighbors = await findSearchNeighbors(
      { id: anchor.id, importedAt: anchor.importedAt },
      ['scenery']
    );
    expect(neighbors).toEqual({ prevHash: listing[0].hash, nextHash: listing[2].hash });
  });

  it('returns null at the listing edges', async () => {
    const only = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-01T00:00:00Z') });

    const neighbors = await findSearchNeighbors(only, ['scenery']);

    expect(neighbors).toEqual({ prevHash: null, nextHash: null });
  });

  it('applies the full query semantics, including negations', async () => {
    const a = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-01T00:00:00Z') });
    const anchor = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-02T00:00:00Z') });
    // Newer matching post that the negation must skip over
    await createPostWithTags(getTestPrisma(), ['scenery', 'cat'], { importedAt: at('2026-01-03T00:00:00Z') });
    const c = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-04T00:00:00Z') });

    const neighbors = await findSearchNeighbors(anchor, ['scenery', '-cat']);

    expect(neighbors).toEqual({ prevHash: c.hash, nextHash: a.hash });
  });

  it('anchors by sort position even when the anchor no longer matches the query', async () => {
    const a = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-01T00:00:00Z') });
    // Anchor lost its 'scenery' tag since the listing was rendered
    const anchor = await createPostWithTags(getTestPrisma(), ['other'], { importedAt: at('2026-01-02T00:00:00Z') });
    const c = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-03T00:00:00Z') });

    const neighbors = await findSearchNeighbors(anchor, ['scenery']);

    expect(neighbors).toEqual({ prevHash: c.hash, nextHash: a.hash });
  });

  it('returns no neighbors for queries that are provably empty', async () => {
    const anchor = await createPostWithTags(getTestPrisma(), ['scenery'], { importedAt: at('2026-01-01T00:00:00Z') });

    // No criteria at all, and a wildcard matching nothing
    expect(await findSearchNeighbors(anchor, [])).toEqual({ prevHash: null, nextHash: null });
    expect(await findSearchNeighbors(anchor, ['nomatch*'])).toEqual({ prevHash: null, nextHash: null });
  });
});
