FROM oven/bun:1-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bun run prisma generate
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install librsvg for Sharp SVG support and ffmpeg for video thumbnails
RUN apk add --no-cache librsvg ffmpeg

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma config, schema, and migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Install prisma CLI for migrations and create thumbnails dir
RUN rm -f package.json bun.lock && \
    bun add prisma dotenv pino pino-pretty && \
    rm -rf ~/.bun/install/cache && \
    mkdir -p /thumbnails && chown nextjs:nodejs /thumbnails

# sharp's prebuilt binding (@img/sharp-linuxmusl-x64) is traced into the
# standalone output, but the libvips runtime it dlopen()s
# (@img/sharp-libvips-linuxmusl-x64, providing libvips-cpp.so) is a native
# linker dependency invisible to Next's JS file tracing — without it sharp
# fails at runtime with ERR_DLOPEN_FAILED. Copy the whole @img scope from the
# deps install (bun only installs the platform-matching variants) so the
# binding's $ORIGIN-relative rpath resolves. Placed AFTER the bun add above
# so no later install step can prune or reshuffle it.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run server.js"]
