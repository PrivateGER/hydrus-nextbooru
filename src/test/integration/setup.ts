import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let prisma: PrismaClient;

/**
 * Start PostgreSQL container and run migrations.
 * Call this in beforeAll of your test suite.
 */
export async function setupTestDatabase(): Promise<{
  prisma: PrismaClient;
  connectionString: string;
}> {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('booru_test')
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ "/var/lib/postgresql/data": "rw" })
    .start();

  const connectionString = container.getConnectionUri();

  // Set DATABASE_URL for Prisma migrations
  process.env.DATABASE_URL = connectionString;

  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe',
  });

  // Create Prisma client with pg adapter
  pool = new Pool({
    connectionString,
    max: 10,
  });

  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  return { prisma, connectionString };
}

/**
 * Stop container and clean up connections.
 * Call this in afterAll of your test suite.
 */
export async function teardownTestDatabase(): Promise<void> {
  await prisma?.$disconnect();
  await pool?.end();
  await container?.stop();
}

/**
 * Get the test Prisma client.
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return prisma;
}

/**
 * Clean all tables for test isolation.
 * Call this in beforeEach to ensure clean state.
 * Order matters due to foreign key constraints.
 */
export async function cleanDatabase(): Promise<void> {
  const p = getTestPrisma();

  // Delete in order of dependencies (children first)
  await p.postTag.deleteMany();
  await p.postGroup.deleteMany();
  await p.thumbnail.deleteMany();
  await p.note.deleteMany();
  await p.noteTranslation.deleteMany();
  await p.post.deleteMany();
  await p.tag.deleteMany();
  await p.group.deleteMany();
  await p.syncState.deleteMany();
  // Clear stats settings for test isolation
  await p.settings.deleteMany({ where: { key: { startsWith: 'stats.' } } });
}
