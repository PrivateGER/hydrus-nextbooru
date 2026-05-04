import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';

type DockerApiError = Error & {
  statusCode?: number;
  reason?: string;
  json?: { message?: string };
};

let container: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;
let prisma: PrismaClient | undefined;

function isContainerAlreadyStoppedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const dockerError = error as DockerApiError;
  const statusCode = dockerError.statusCode;
  const message = error.message.toLowerCase();
  const reason = dockerError.reason?.toLowerCase() ?? '';
  const dockerMessage = dockerError.json?.message?.toLowerCase() ?? '';

  return statusCode === 404
    || message.includes('no such container')
    || message.includes('not running')
    || reason.includes('not running')
    || dockerMessage.includes('not running');
}

function throwIfCleanupErrors(cleanupErrors: Error[]): void {
  if (cleanupErrors.length === 1) {
    throw cleanupErrors[0];
  }
  if (cleanupErrors.length > 1) {
    const aggregatedError = new Error(`Teardown failed with ${cleanupErrors.length} errors`);
    (aggregatedError as Error & { errors?: Error[] }).errors = cleanupErrors;
    throw aggregatedError;
  }
}

/**
 * Start PostgreSQL container and run migrations.
 * Call this in beforeAll of your test suite.
 */
export async function setupTestDatabase(): Promise<{
  prisma: PrismaClient;
  connectionString: string;
}> {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer('tensorchord/vchord-postgres:pg18-v1.1.1')
    .withDatabase('booru_test')
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ "/var/lib/postgresql": "rw" })
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
  const cleanupErrors: Error[] = [];

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error
          ? error
          : new Error(`Failed to disconnect Prisma client: ${String(error)}`)
      );
    } finally {
      prisma = undefined;
    }
  } else {
    prisma = undefined;
  }

  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error
          ? error
          : new Error(`Failed to close PostgreSQL pool: ${String(error)}`)
      );
    } finally {
      pool = undefined;
    }
  } else {
    pool = undefined;
  }

  if (!container) {
    throwIfCleanupErrors(cleanupErrors);
    return;
  }

  try {
    await container.stop();
  } catch (error) {
    if (!isContainerAlreadyStoppedError(error)) {
      cleanupErrors.push(
        error instanceof Error
          ? error
          : new Error(`Failed to stop test container: ${String(error)}`)
      );
    }
  } finally {
    container = undefined;
  }

  throwIfCleanupErrors(cleanupErrors);
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
  await p.postRecommendation.deleteMany();
  await p.postTag.deleteMany();
  await p.postGroup.deleteMany();
  await p.thumbnail.deleteMany();
  await p.note.deleteMany();
  await p.contentTranslation.deleteMany();
  await p.phashEntry.deleteMany();
  await p.semanticQueryEmbedding.deleteMany();
  await p.postEmbedding.deleteMany();
  await p.$executeRaw`DELETE FROM "EmbeddingBatchState"`;
  await p.post.deleteMany();
  await p.tag.deleteMany();
  await p.group.deleteMany();
  await p.syncState.deleteMany();
  // Clear settings for test isolation (stats and OpenRouter settings)
  await p.settings.deleteMany({
    where: {
      OR: [
        { key: { startsWith: 'stats.' } },
        { key: { startsWith: 'openrouter.' } },
      ],
    },
  });
}

/**
 * Recalculate postCount and idfWeight for all tags.
 * Call this in tests after creating posts with tags to ensure
 * recommendation algorithms have accurate data.
 */
export async function recalculateTagStats(): Promise<void> {
  const p = getTestPrisma();

  // Update postCount
  await p.$executeRaw`
    UPDATE "Tag" t SET "postCount" = (
      SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
    )
  `;

  // Update idfWeight based on postCount
  const totalPosts = await p.post.count();
  if (totalPosts > 0) {
    await p.$executeRaw`
      UPDATE "Tag" SET "idfWeight" = GREATEST(0, LN(${totalPosts}::FLOAT / GREATEST(1, "postCount")))
      WHERE "postCount" > 0
    `;
    await p.$executeRaw`
      UPDATE "Tag" SET "idfWeight" = 0 WHERE "postCount" = 0
    `;
  }
}
