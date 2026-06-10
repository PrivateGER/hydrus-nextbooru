import { describe, it, expect } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import { seedLargeDataset } from '../perf/seeders';

async function seedFreshDatabase(): Promise<{ hashes: string[]; tagCounts: string }> {
  const container = await new PostgreSqlContainer('tensorchord/vchord-postgres:pg18-v1.1.1')
    .withDatabase('det_test')
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .start();

  const connectionString = container.getConnectionUri();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe',
  });

  const pool = new Pool({ connectionString, max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await seedLargeDataset(prisma, { posts: 500, uniqueTags: 200, tagsPerPost: 8 });
    const posts = await prisma.post.findMany({ select: { hash: true }, orderBy: { hash: 'asc' } });
    const tags = await prisma.tag.findMany({
      select: { name: true, postCount: true },
      orderBy: { name: 'asc' },
    });
    return {
      hashes: posts.map((p) => p.hash),
      tagCounts: tags.map((t) => `${t.name}=${t.postCount}`).join(','),
    };
  } finally {
    await prisma.$disconnect();
    await pool.end();
    await container.stop();
  }
}

describe('Seeding determinism', () => {
  it('produces identical post hashes and tag distributions across fresh databases', async () => {
    const first = await seedFreshDatabase();
    const second = await seedFreshDatabase();

    expect(first.hashes.length).toBe(500);
    expect(second.hashes).toEqual(first.hashes);
    expect(second.tagCounts).toBe(first.tagCounts);
  }, 300_000);
});
