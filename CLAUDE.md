# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js-based image gallery (booru) that syncs with Hydrus, a personal media management system. Users can browse, search by tags, and view images/videos synced from their Hydrus instance.

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
npm test         # Run all tests (unit + integration)
npm run test:ui  # Run all tests with coverage (optional)
```

Tests use Vitest with real PostgreSQL via Testcontainers. Integration tests require Docker.

## Architecture

### Tech Stack
- **Next.js 16** with App Router and React 19
- **Prisma ORM** with PostgreSQL (via @prisma/adapter-pg)
- **Tailwind CSS** for styling
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
