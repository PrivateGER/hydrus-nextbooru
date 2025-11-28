# Hydrus Nextbooru

A Next.js-based image gallery that syncs with [Hydrus Network](https://hydrusnetwork.github.io/hydrus/). Still quite WIP, but it's usable. Don't use if you aren't okay with starting a fresh sync when you update.

You can browse, search by tags, and view images/videos **without** depending on Hydrus once the sync is done. Only the location Hydrus stores the files is required to be accessible from the server.

Supports:
- Tag-based search with autocomplete and co-occurrence filtering 
- Category-colored tags (artist, character, copyright, meta, general)
- Post grouping based on source URLs (Pixiv, Twitter, dA, Danbooru, Gelbooru)
- Lazy loading images with blurhash placeholders and thumbnail previews
- Batch sync from Hydrus with progress tracking

## Requirements

- Node.js 22+
- PostgreSQL 18+ (lower probably works, but recommend 18+ for performance)
- Hydrus Network with Client API enabled and available in network

## Setup

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
   npm run db:deploy
   npm run db:generate
   ```
   
5. Build the server:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

## Syncing from Hydrus

1. Enable the Client API in Hydrus (services > manage services > client api)
2. Create an API key with "search for and fetch files" and "see local file paths" permissions
3. Start a sync in the admin panel
