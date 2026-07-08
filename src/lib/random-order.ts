import { createHash } from 'crypto';
import { PrismaClient } from '@/generated/prisma/client';
import { prisma as defaultPrisma } from '@/lib/db';

export interface RandomPostSummary {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

export function seedToHexCursor(seed: string, length: 32 | 64): string {
  const digest = createHash('sha256').update(seed).digest('hex');
  return digest.slice(0, length);
}

/**
 * Find a post's immediate neighbors within the seeded random listing.
 *
 * The rotation orders posts by hash ascending starting at the seed-derived
 * cursor and wraps around: [cursor..max] then [min..cursor). Hashes are
 * unique, so the order is total. Neighbors are resolved with indexed
 * hash-comparison lookups; the second query of each pair only runs at the
 * wrap boundary.
 */
export async function findRotationNeighbors(
  anchorHash: string,
  seed: string,
  prisma: PrismaClient = defaultPrisma
): Promise<{ prevHash: string | null; nextHash: string | null }> {
  const cursor = seedToHexCursor(seed, 64);
  const select = { hash: true } as const;
  const asc = { hash: 'asc' as const };
  const desc = { hash: 'desc' as const };

  const inFirstSegment = anchorHash >= cursor;

  const [next, prev] = await Promise.all([
    (async () => {
      if (inFirstSegment) {
        // Continue up the first segment...
        const sameSegment = await prisma.post.findFirst({
          where: { hash: { gt: anchorHash } },
          orderBy: asc,
          select,
        });
        if (sameSegment) return sameSegment.hash;
        // ...or wrap to the start of the second segment.
        const wrapped = await prisma.post.findFirst({
          where: { hash: { lt: cursor } },
          orderBy: asc,
          select,
        });
        return wrapped?.hash ?? null;
      }
      // Second segment ends just below the cursor — no further wrap.
      const sameSegment = await prisma.post.findFirst({
        where: { hash: { gt: anchorHash, lt: cursor } },
        orderBy: asc,
        select,
      });
      return sameSegment?.hash ?? null;
    })(),
    (async () => {
      if (inFirstSegment) {
        // The first segment starts at the cursor — nothing before its head.
        const sameSegment = await prisma.post.findFirst({
          where: { hash: { lt: anchorHash, gte: cursor } },
          orderBy: desc,
          select,
        });
        return sameSegment?.hash ?? null;
      }
      // Back down the second segment...
      const sameSegment = await prisma.post.findFirst({
        where: { hash: { lt: anchorHash } },
        orderBy: desc,
        select,
      });
      if (sameSegment) return sameSegment.hash;
      // ...or wrap back to the tail of the first segment.
      const wrapped = await prisma.post.findFirst({
        where: { hash: { gte: cursor } },
        orderBy: desc,
        select,
      });
      return wrapped?.hash ?? null;
    })(),
  ]);

  return { prevHash: prev, nextHash: next };
}

export async function getPostsByHashRotation({
  page,
  pageSize,
  seed,
  prisma = defaultPrisma,
}: {
  page: number;
  pageSize: number;
  seed: string;
  prisma?: PrismaClient;
}): Promise<RandomPostSummary[]> {
  if (pageSize <= 0) {
    return [];
  }

  const offset = (page - 1) * pageSize;
  const cursor = seedToHexCursor(seed, 64);

  const firstRows = await prisma.$queryRaw<RandomPostSummary[]>`
    SELECT id, hash, width, height, blurhash, "mimeType"
    FROM "Post"
    WHERE hash >= ${cursor}
    ORDER BY hash ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const posts = firstRows;
  if (posts.length >= pageSize) {
    return posts;
  }

  let wrapOffset = 0;
  if (posts.length === 0 && offset > 0) {
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM "Post"
      WHERE hash >= ${cursor}
    `;
    wrapOffset = Math.max(0, offset - Number(count));
  }

  const wrappedRows = await prisma.$queryRaw<RandomPostSummary[]>`
    SELECT id, hash, width, height, blurhash, "mimeType"
    FROM "Post"
    WHERE hash < ${cursor}
    ORDER BY hash ASC
    LIMIT ${pageSize - posts.length} OFFSET ${wrapOffset}
  `;

  return [...posts, ...wrappedRows];
}
