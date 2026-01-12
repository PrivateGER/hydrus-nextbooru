# Hydrus Nextbooru

[![codecov](https://codecov.io/gh/PrivateGER/hydrus-nextbooru/branch/master/graph/badge.svg?token=7rvkUNLyNO)](https://codecov.io/gh/PrivateGER/hydrus-nextbooru)

A Next.js-based image gallery that syncs with [Hydrus Network](https://hydrusnetwork.github.io/hydrus/). Still quite WIP, but it's usable. Don't use if you aren't okay with starting a fresh sync when you update. Things will break sometimes.

A live demo filled with random Touhou images is running at https://nextbooru-demo.lattemacchiato.dev/.

You can browse, search by tags, and view images/videos **without** depending on Hydrus once the sync is done. Only the location Hydrus stores the files is required to be accessible from the server, all metadata is locally saved after syncing.

Supports:
- Tag-based search with autocomplete and co-occurrence filtering + wildcard support + meta tags (file types)
- Category-colored tags (artist, character, copyright, meta, general)
- Automatic post grouping based on source URLs (Pixiv, Twitter, dA, Danbooru, Gelbooru) and titles (experimental!)
- Lazy loading images with blurhash placeholders and thumbnail previews
- Search query builder tree, with progressively narrowing down tags
- Thumbnail generation of many file types
- Very fast server-side rendering
- Fast searches with optimized queries
- Incremental sync (to a point, Hydrus requires scanning everything but Nextbooru minimizes unneeded writes)
- OpenRouter-based translations of post titles, bodies and images
- Animated thumbnail support

## Requirements

- Node.js 25+ (or Bun for faster execution, default in docker image)
- PostgreSQL 18+ (lower probably works, but recommend 18+ for performance)
- Hydrus Network with Client API enabled and available in network for first sync

## Development Setup

Use the docker compose stack for actual deployment! 

Pre-built image available at `ghcr.io/privateger/hydrus-nextbooru:latest`.

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/booru
   HYDRUS_API_URL=http://localhost:45869
   HYDRUS_API_KEY=your_api_key_here
   HYDRUS_FILES_PATH=/path/to/hydrus/db/client_files
   ```

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:deploy
   ```
   
5. Build the server:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

See documentation contained within for usage guidance. 

No screenshots yet, still developing actively. Check the demo.

## Performance

My personal "production" server running Nextbooru holds 110k files with 140k tags, with 60k groups. Up to this database size I will optimize for speed, I cannot guarantee how it scales past it.

Open for improvements, PRs and whatever of course.
