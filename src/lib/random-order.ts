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
