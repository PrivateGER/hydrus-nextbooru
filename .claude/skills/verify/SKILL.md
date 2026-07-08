---
name: verify
description: Build, run, and drive this app end-to-end with seeded data to verify changes at the browser surface.
---

# Verifying hydrus-nextbooru end-to-end

Recipe for observing changes in the running app (not tests). Total setup ~5 min.

## 1. Database

Use the same image as the test suite (needs pgvector + pgcrypto):

```bash
docker run -d --name verify-pg -e POSTGRES_USER=booru -e POSTGRES_PASSWORD=booru \
  -e POSTGRES_DB=booru -p 55432:5432 tensorchord/vchord-postgres:pg18-v1.1.1
export DATABASE_URL="postgresql://booru:booru@localhost:55432/booru"
npx prisma migrate deploy
```

If `docker info` fails, start the daemon first: `sudo dockerd &` and wait for readiness.

## 2. Seed data + media files

The app serves files from `HYDRUS_FILES_PATH` using `f{hash[0:2]}/{hash}{ext}` layout;
thumbnails are generated on demand into `THUMBNAIL_PATH`. Generate PNGs with `sharp`
(already a dependency), sha256 them, write them into that layout, then insert
Posts/Groups with the generated Prisma client. Required Post fields: `hydrusFileId`
(unique int), `hash`, `mimeType`, `extension` (with leading dot), `fileSize`,
`importedAt`. Run seed scripts with `npx tsx` from the repo root so `@/generated/prisma/client`
and node_modules resolve (the generated client is TypeScript; plain `node` can't import it).

## 3. Run

```bash
DATABASE_URL=... HYDRUS_FILES_PATH=<files-dir> THUMBNAIL_PATH=<thumbs-dir> PORT=3999 npm run start
```

`npm run build` needs a `DATABASE_URL` set (any syntactically valid URL works — no
connection is made at build time). Admin routes need a session; everything else is public.

## 4. Drive

Playwright: import from `playwright-core` (install with `npm install --no-save playwright-core`)
and launch with `executablePath: "/opt/pw-browsers/chromium"` — do NOT run `playwright install`.
Use `devices["iPhone 13"]` for mobile emulation (touch taps via `page.touchscreen.tap`).
Run driver scripts from the repo root so imports resolve.

## Gotchas

- `npm test` fails on some node versions (`--no-webstorage` not allowed in NODE_OPTIONS);
  `npx vitest run` works.
- `npx prisma generate` needs DATABASE_URL set (dummy value fine).
- Pages using `notFound()` inside Suspense stream a 200 status with 404 UI — check the
  body, not the status code.
- Flows worth driving: /groups (listing + filters), /groups/[id], /groups/[id]/read/[page]
  (reader: tap zones, swipe, keyboard, RTL, thumb strip, progress persistence),
  /post/[hash] (?in= group navigation context, filmstrips, prev/next arrows).
