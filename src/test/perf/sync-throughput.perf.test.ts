import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../integration/setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import {
  createMockHydrusServer,
  createMockHydrusState,
  addFilesToState,
} from '@/test/mocks/hydrus-server';
import { createMockFileWithTags } from '@/test/mocks/fixtures/hydrus-metadata';
import type { SetupServer } from 'msw/node';
import { measure, stats, formatStats } from './helpers';
import { recordBenchmark } from './results';
import { createRng, createZipfSampler } from './rng';

let syncFromHydrus: typeof import('@/lib/hydrus/sync').syncFromHydrus;

const FILE_COUNT = 2_000;
const RUNS = 3;

/**
 * Build a deterministic Hydrus file set with unique 64-hex hashes and
 * Zipf-distributed tags. Tags are required to exercise the tag-mapping
 * and relation pipeline; hash uniqueness is required so every file
 * inserts as a distinct post.
 */
function buildSyncFiles(count: number) {
  const rng = createRng(0x57c4);
  const tagPool = Array.from({ length: 400 }, (_, i) => {
    if (i % 10 === 0) return `artist:perf_artist_${i}`;
    if (i % 10 === 1) return `character:perf_character_${i}`;
    return `perf_tag_${i}`;
  });
  const sampleTag = createZipfSampler(tagPool.length, 1.0, rng);

  return Array.from({ length: count }, (_, i) => {
    const tagCount = 4 + Math.floor(rng() * 9); // 4-12 tags
    const tags = new Set<string>();
    let attempts = 0;
    while (tags.size < tagCount && attempts < tagCount * 5) {
      tags.add(tagPool[sampleTag()]);
      attempts++;
    }

    return createMockFileWithTags([...tags], {
      file_id: i + 1,
      hash: i.toString(16).padStart(64, '0'),
    });
  });
}

/**
 * Sync ingest throughput: full pipeline from Hydrus metadata fetch
 * (MSW-mocked, so network cost is ~zero) through batch processing into
 * posts, tags, and relations. Few iterations — this is a macro benchmark
 * tracked for trend, not a latency distribution.
 */
describe('Performance: Sync throughput', () => {
  let server: SetupServer | undefined;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);

    syncFromHydrus = (await import('@/lib/hydrus/sync')).syncFromHydrus;
  }, 600_000);

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it(`ingests ${FILE_COUNT} files with tags`, { timeout: 600_000 }, async () => {
    const files = buildSyncFiles(FILE_COUNT);
    const times: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      await cleanDatabase();
      invalidateAllCaches();

      const state = createMockHydrusState(0);
      addFilesToState(state, files);
      server = createMockHydrusServer(state);
      server.listen({ onUnhandledRequest: 'error' });

      const { result, ms } = await measure(() => syncFromHydrus());
      server.close();
      server = undefined;

      if (result.phase !== 'complete' || result.processedFiles !== FILE_COUNT) {
        throw new Error(
          `Sync run ${run} did not complete cleanly: phase=${result.phase}, processed=${result.processedFiles}, errors=${result.errors.length}`
        );
      }

      times.push(ms);
      console.log(
        `  run ${run + 1}: ${(ms / 1000).toFixed(1)}s (${Math.round(FILE_COUNT / (ms / 1000))} files/s)`
      );
    }

    const s = stats(times);
    console.log(`\nSync ingest (${FILE_COUNT} files):`);
    console.table(formatStats(s));

    recordBenchmark(`Sync ingest (${FILE_COUNT} files)`, s);
  });
});
