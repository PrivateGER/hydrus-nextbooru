# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js-based image gallery (booru) that syncs with Hydrus, a personal media management system. Users can browse, search by tags, and view images/videos synced from their Hydrus instance.
Supports both a dark and light theme.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Run production server
npm run lint     # ESLint
npm test         # Run all tests
npx prisma generate   # Generate Prisma client after schema changes
npx prisma migrate dev  # Create and apply migrations
```

## Testing

**Always run tests after making changes:**
```bash
npm test               # Unit tests
npm run test:integration  # Integration tests (real PostgreSQL via Testcontainers)
npm run test:guards    # Performance guards: query-plan + query-count (N+1) checks
npm run test:perf      # Timing benchmarks (PERF_DATASET_SIZE=small|medium|large|xlarge)
```

Tests use Vitest with real PostgreSQL via Testcontainers. Integration, guard, and perf tests require Docker.

**Performance testing model:**
- `test:guards` is deterministic and runs on every PR: it captures the SQL each hot path executes, re-runs it under `EXPLAIN`, asserts index usage, and enforces per-endpoint query-count budgets (pinned in `src/test/guards/query-counts.guard.test.ts` — if you add a query to an endpoint, justify raising its budget).
- `test:perf` measures wall-clock timings. Thresholds are enforced locally but report-only on CI (`PERF_ASSERT` overrides); CI regressions are surfaced by trend tracking instead (nightly + master runs feed github-action-benchmark via `perf-results/*.json`); trend alerts warn (job summary, commit comment on push runs) but never fail the job, since single-run comparisons on shared runners swing 2-4x on identical code. CI benchmark runs serialize test files (`--no-file-parallelism`): parallel perf files contend for the runner's CPUs and swing same-commit timings 2-4x. A weekly large-dataset run tracks a separate trend series for scale-dependent regressions; at that scale serialization is also required because parallel tmpfs-backed Postgres containers would exhaust runner memory.
- Benchmark names must stay stable across runs — the trend tracker keys series by name.
- Dataset seeding is deterministic (seeded PRNG, Zipf-distributed tags) in `src/test/perf/seeders.ts`; changing the seed or distribution shifts every benchmark baseline.

## Architecture

### Tech Stack
- **Next.js 16** with App Router and React 19
- **Prisma ORM** with PostgreSQL (via @prisma/adapter-pg)
- **Tailwind CSS** for styling
- **Heroicons** (`@heroicons/react`) for icons - use outline (24px) or solid variants
- **TypeScript** with path alias `@/*` → `./src/*`

### Database Models (prisma/schema.prisma)
- **Post**: Media files with hash (SHA256), file metadata, rating, dimensions
- **Tag**: Name + category (GENERAL, ARTIST, CHARACTER, COPYRIGHT, META)
- **Group**: Groups related posts from same source (Pixiv, Twitter)
- **SyncState**: Tracks async sync operation progress

### Key Directories
```
docs/               # Hydrus Client API documentation

src/lib/hydrus/     # Hydrus API integration
  client.ts         # API wrapper for Hydrus endpoints
  sync.ts           # Batch sync orchestration (256 files/batch, 20 concurrent)
  tag-mapper.ts     # Namespace → category conversion
  url-parser.ts     # Pixiv/Twitter URL extraction for grouping

src/app/api/        # API routes
  files/[hash]/     # File streaming with range request support
  thumbnails/[hash]/ # Thumbnail serving
  tags/search/      # Tag autocomplete with co-occurrence filtering
  admin/sync/       # Sync management (start/cancel/status)

src/components/     # React components
  search-bar.tsx    # Multi-tag search with debounced autocomplete
  post-card.tsx     # Grid item with lazy loading and blurhash
  tag-sidebar.tsx   # Category-colored tag display
```

### Data Flow
1. Hydrus → HydrusClient API → syncFromHydrus() batch processor
2. Batch processor → PostgreSQL (posts, tags, groups via transactions)
3. Next.js SSR pages → Prisma queries → React components → Browser

### Environment Variables
```
DATABASE_URL        # PostgreSQL connection string
HYDRUS_API_URL      # Hydrus server (e.g., http://localhost:45869)
HYDRUS_API_KEY      # Hydrus API access key
HYDRUS_FILES_PATH   # Path to Hydrus file storage directory
```

### Debugging
```bash
LOG_QUERIES=true npm run dev  # Log all SQL queries with timing
```

Query logging outputs formatted SQL with execution duration via pino. Useful for debugging slow queries.

## Key Patterns

- **Tag categorization**: Namespaced tags (e.g., `artist:name`) map to categories via `tag-mapper.ts`
- **File serving**: Hash-based paths (`f{hash[0:2]}/{hash}.{ext}`) with 1-year cache headers
- **Sync concurrency**: Uses Promise.all with chunked batches to avoid overwhelming Hydrus
- **Tag search**: Progressive filtering - only shows tags that co-occur with already-selected tags

## Deployment / Concurrency

**The app currently assumes a SINGLE Next.js process.** Several mechanisms keep
state in process memory and therefore do NOT coordinate across multiple
workers/replicas. They are silently bypassed (each process gets its own copy)
under a multi-worker or multi-replica deployment:

- **In-memory rate limiter** (`src/lib/rate-limit.ts`): the sliding-window
  counters live in a per-process `Map`. With N processes a client effectively
  gets up to N× the configured limit. Replace with a shared store (e.g. Redis)
  before scaling out.
- **In-process batch locks** on the admin maintenance routes — thumbnails,
  phash, and embeddings (`src/app/api/admin/{thumbnails,phash,embeddings}/route.ts`)
  each hold a module-level `createBatchRunner()` instance (`src/lib/batch-runner.ts`)
  whose running flag prevents overlapping batch runs. Across multiple processes
  the guard does not hold and batches can run concurrently against the same data.
- **Recommendation compute coalescing** (`src/lib/recommendations.ts`): the
  in-flight promise map that dedupes concurrent recomputes for the same post is
  per-process. The underlying DB writes are transactional and remain safe
  regardless, but cross-process requests may each recompute. Note the feed's
  batched path (`getTagNeighborhoodsForSeeds`) does not use this map at all —
  it relies solely on the 24h `PostRecommendation` cache plus its own
  delete+insert transaction, so concurrent feed builds are safe but may
  duplicate compute.

If/when moving to multi-process, these need a shared coordination layer
(distributed lock / shared cache) rather than in-memory state.
