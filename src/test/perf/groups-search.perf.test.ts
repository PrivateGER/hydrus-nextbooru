import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { seedDataset, seedGroups } from './seeders';
import { benchmarkWithStats } from './helpers';
import { SourceType } from '@/generated/prisma/client';
import type * as GroupsModule from '@/lib/groups';

let searchGroups: typeof GroupsModule.searchGroups;

const SEED_PARAM = 'perf-groups-seed';

/**
 * Groups listing/filter benchmarks: the /groups page runs searchGroups on
 * every request, and a filtered request evaluates the where clause in up to
 * five queries (stats, count, page hashes, hash wrap, group hydration).
 */
describe('Performance: Groups search', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    await seedDataset(prisma);
    const groupsOverride = process.env.PERF_GROUPS ? Number(process.env.PERF_GROUPS) : undefined;
    const seeded = await seedGroups(prisma, { groups: groupsOverride });
    console.log(`  Seeded ${seeded.groupCount} groups, ${seeded.membershipCount} memberships, ${seeded.translationCount} translations`);

    // Dynamic import required: the groups module must load only after
    // setTestPrisma wires the Testcontainers client (perf-suite pattern).
    searchGroups = (await import('@/lib/groups')).searchGroups;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  it('unfiltered listing (random order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: unfiltered random page',
      async () => {
        const result = await searchGroups({ order: 'random', seed: SEED_PARAM, page: 1, pageSize: 50 });
        expect(result.groups.length).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });

  it('unfiltered listing (newest order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: unfiltered newest page',
      async () => {
        const result = await searchGroups({ order: 'newest', page: 1, pageSize: 50 });
        expect(result.groups.length).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });

  it('title query filter (random order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: title query, random order',
      async () => {
        // 'sunset' appears in seeded TITLE group titles and translations.
        const result = await searchGroups({ query: 'sunset', order: 'random', seed: SEED_PARAM, page: 1, pageSize: 50 });
        expect(result.filteredCount).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });

  it('title query filter (newest order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: title query, newest order',
      async () => {
        const result = await searchGroups({ query: 'sunset', order: 'newest', page: 1, pageSize: 50 });
        expect(result.filteredCount).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });

  it('creator filter (random order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: creator filter, random order',
      async () => {
        // Matches seeded ARTIST tags (artist_tag_N) via trigram ILIKE.
        const result = await searchGroups({ creatorFilter: 'artist_tag_1', order: 'random', seed: SEED_PARAM, page: 1, pageSize: 50 });
        expect(result.filteredCount).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });

  it('type filter (newest order)', { timeout: 600_000 }, async () => {
    const s = await benchmarkWithStats(
      'Groups: type filter PIXIV, newest order',
      async () => {
        const result = await searchGroups({ typeFilter: SourceType.PIXIV, order: 'newest', page: 1, pageSize: 50 });
        expect(result.filteredCount).toBeGreaterThan(0);
      },
      { iterations: 20, warmup: 3 }
    );
    expect(s.p50).toBeGreaterThan(0);
  });
});
