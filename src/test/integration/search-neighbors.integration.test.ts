import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from './setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, createPostWithTags } from './factories';
import { invalidateAllCaches } from '@/lib/cache';

let findSearchNeighbors: typeof import('@/lib/search').findSearchNeighbors;
let findGalleryNeighbors: typeof import('@/lib/search').findGalleryNeighbors;
let searchPosts: typeof import('@/lib/search').searchPosts;
let findRotationNeighbors: typeof import('@/lib/random-order').findRotationNeighbors;
let seedToHexCursor: typeof import('@/lib/random-order').seedToHexCursor;

const at = (iso: string) => new Date(iso);

describe('findSearchNeighbors (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    ({ findSearchNeighbors, findGalleryNeighbors, searchPosts } = await import('@/lib/search'));
    ({ findRotationNeighbors, seedToHexCursor } = await import('@/lib/random-order'));
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

  describe('findGalleryNeighbors', () => {
    it('follows the newest-first listing', async () => {
      const a = await createPost(getTestPrisma(), { importedAt: at('2026-01-01T00:00:00Z') });
      const b = await createPost(getTestPrisma(), { importedAt: at('2026-01-02T00:00:00Z') });
      const c = await createPost(getTestPrisma(), { importedAt: at('2026-01-03T00:00:00Z') });

      expect(await findGalleryNeighbors(b, 'newest')).toEqual({ prevHash: c.hash, nextHash: a.hash });
    });

    it('reverses for the oldest-first listing, breaking importedAt ties by id', async () => {
      const shared = at('2026-01-01T00:00:00Z');
      const a = await createPost(getTestPrisma(), { importedAt: shared });
      const b = await createPost(getTestPrisma(), { importedAt: shared });
      const c = await createPost(getTestPrisma(), { importedAt: shared });

      // Ascending listing: a, b, c (by id at equal importedAt).
      expect(await findGalleryNeighbors(b, 'oldest')).toEqual({ prevHash: a.hash, nextHash: c.hash });
      expect(await findGalleryNeighbors(a, 'oldest')).toEqual({ prevHash: null, nextHash: b.hash });
      expect(await findGalleryNeighbors(c, 'oldest')).toEqual({ prevHash: b.hash, nextHash: null });
    });
  });

  describe('findRotationNeighbors', () => {
    const SEED = 'abcd1234';

    it('walks the seeded rotation, wrapping from the top of the hash space', async () => {
      const cursor = seedToHexCursor(SEED, 64);
      // Rotation listing: [cursor..max] ascending, then wrap to [min..cursor).
      const high1 = 'f'.repeat(63) + '0';
      const high2 = 'f'.repeat(63) + '1';
      const low1 = '0'.repeat(63) + '1';
      const low2 = '0'.repeat(63) + '2';
      // The fixed seed's cursor sits strictly between the crafted hashes; if
      // this ever fails the seed constant needs adjusting, not the assertions.
      expect(low2 < cursor && cursor < high1).toBe(true);

      for (const hash of [low1, low2, high1, high2]) {
        await createPost(getTestPrisma(), { hash });
      }

      // Listing order: high1, high2, low1, low2.
      expect(await findRotationNeighbors(high1, SEED)).toEqual({ prevHash: null, nextHash: high2 });
      expect(await findRotationNeighbors(high2, SEED)).toEqual({ prevHash: high1, nextHash: low1 });
      expect(await findRotationNeighbors(low1, SEED)).toEqual({ prevHash: high2, nextHash: low2 });
      expect(await findRotationNeighbors(low2, SEED)).toEqual({ prevHash: low1, nextHash: null });
    });

    it('handles a single-post rotation', async () => {
      const only = await createPost(getTestPrisma(), { hash: 'f'.repeat(64) });
      expect(await findRotationNeighbors(only.hash, SEED)).toEqual({ prevHash: null, nextHash: null });
    });
  });
});
