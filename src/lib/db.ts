import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Escapes special characters for SQL LIKE/ILIKE patterns.
 * Handles: backslash (escape char), % (multi-char wildcard), _ (single-char wildcard)
 */
export function escapeSqlLike(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Test injection support
let testPrisma: PrismaClient | null = null;

/**
 * Set a test Prisma client to be used instead of the real one.
 * Pass null to restore normal behavior.
 */
export function setTestPrisma(client: PrismaClient | null): void {
  testPrisma = client;
}

function createPrismaClient() {
  // Configure pool for concurrent sync operations:
  // - max: 40 connections (20 concurrent files + bulk operations + API requests)
  // - idleTimeoutMillis: 30s before closing idle connections
  // - connectionTimeoutMillis: 30s timeout for acquiring a connection (handles contention)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 40,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  // Log pool errors for observability
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  // Store pool reference for potential cleanup
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// Use Proxy to allow runtime test injection
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    // If test client is set, use it
    if (testPrisma) {
      return (testPrisma as unknown as Record<string | symbol, unknown>)[prop];
    }

    // Otherwise use global/create new client
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return (globalForPrisma.prisma as unknown as Record<string | symbol, unknown>)[prop];
  },
});

if (process.env.NODE_ENV !== "production" && !globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export default prisma;
