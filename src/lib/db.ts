import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
