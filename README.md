# Hydrus Nextbooru

[![codecov](https://codecov.io/gh/PrivateGER/hydrus-nextbooru/branch/master/graph/badge.svg?token=7rvkUNLyNO)](https://codecov.io/gh/PrivateGER/hydrus-nextbooru)
![License](https://img.shields.io/github/license/PrivateGER/hydrus-nextbooru)
![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)


A Next.js-based image gallery that syncs with [Hydrus Network](https://hydrusnetwork.github.io/hydrus/).

A live demo filled with random Touhou images is running at https://nextbooru-demo.lattemacchiato.dev/.

You can browse, search by tags, and view images/videos **without** depending on Hydrus once the sync is done. Only the location Hydrus stores the files is required to be accessible from the server, all metadata is locally saved after syncing.

> [!WARNING]
> Still WIP. Don't use if you aren't okay with starting a fresh sync when you update.

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/b4e6a15d-ee7e-4288-b84f-1a0689f796ea" width="1333" height="1354" alt="Gallery view" /></td>
    <td><img width="1280" height="955" alt="2026-01-21_12-49" src="https://github.com/user-attachments/assets/4951d5a5-b5d3-4fc6-9037-8c77761ef112" alt="Tag tree" /></td>
  </tr>
  <tr>
   <td><img width="1274" height="437" alt="2026-01-21_12-50" src="https://github.com/user-attachments/assets/6ce1b4d1-bc4a-4071-96ac-b87ec52e17d0" alt="Search page" /></td>
   <td><img width="1285" height="1061" alt="2026-01-21_12-52" src="https://github.com/user-attachments/assets/b773fe5f-b4b6-4601-b9bf-8f242668b8d4" alt="Post page" /></td>
  </tr>
</table>

Unorganized feature list:
- Tag-based search with autocomplete and co-occurrence filtering + wildcard support + meta tags (file types)
- Category-based (artist, character, copyright, meta, general)
- Automatic post grouping based on source URLs (Pixiv, Twitter, dA, Danbooru, Gelbooru) and titles
- Lazy loading images with blurhash placeholders and thumbnail previews
- Search query builder tree, with progressively narrowing down tags
- Thumbnail generation of many file types (including animated ones)
- Very fast server-side rendering
- Fast searches with optimized queries
- Incremental sync (to a point, Hydrus requires scanning everything but Nextbooru minimizes unneeded writes)
- OpenRouter-based translations of post titles, bodies and images

Try the demo to get a feel for it.

## Requirements
- Hydrus Network with Client API enabled and available in network for first sync

Runtime:

- Docker

_or_

- Node.js 25+ (or Bun for faster execution, default in docker image)
- PostgreSQL 18+ (lower works, but recommend 18+ for performance)

## Setup

Grab the docker-compose.yml and adjust the Hydrus bind mount. Copy .env.example to .env, then fill in the variables to fit your setup.

Note: Nextbooru should run behind a reverse proxy supporting caching for performance. Ensure you pass `X-Forwarded-For` to the server.

## Development Setup

Use the docker compose stack for actual deployment! 

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

## Performance

My personal "production" server running Nextbooru holds 110k files with 140k tags, with 60k groups. Up to this database size I will optimize for speed, I cannot guarantee how it scales past it.

Open for improvements, PRs and whatever of course.
