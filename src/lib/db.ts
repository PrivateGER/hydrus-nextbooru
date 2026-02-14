import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { format as formatSql } from "sql-formatter";
import { dbLog } from "@/lib/logger";
import { trace, SpanStatusCode } from "@opentelemetry/api";

/**
 * Escape characters in a string for safe use in SQL LIKE/ILIKE patterns.
 *
 * This function inserts backslash escapes before the following characters: backslash (`\`), percent (`%`), and underscore (`_`).
 *
 * @param input - The string to escape for a LIKE/ILIKE pattern
 * @returns The escaped string with `\`, `%`, and `_` characters prefixed by a backslash
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

function createPrismaClient(): PrismaClient {
  // Enable query logging when LOG_QUERIES=true
  const enableQueryLog = process.env.LOG_QUERIES === 'true';

  // Configure pool for concurrent sync operations:
  // - max: 40 connections (20 concurrent files + bulk operations + API requests)
  // - idleTimeoutMillis: 30s before closing idle connections
  // - connectionTimeoutMillis: 30s timeout for acquiring a connection (handles contention)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 40,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    // Enable query logging at the pg level (works with driver adapters)
    ...(enableQueryLog && {
      log: (msg: string) => {
        dbLog.debug({ pgLog: msg }, 'pg pool');
      },
    }),
  });

  // Log pool errors for observability
  pool.on('error', (err) => {
    dbLog.error({ error: err instanceof Error ? err.message : String(err) }, 'Unexpected database pool error');
  });

  dbLog.debug({ maxConnections: 40, idleTimeoutMs: 30000, connectionTimeoutMs: 30000, queryLogging: enableQueryLog }, 'Database pool initialized');

  // Store pool reference for potential cleanup
  globalForPrisma.pool = pool;

  // Wrap pool.query to add tracing and optionally log queries
  const originalQuery = pool.query.bind(pool);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).query = async (...args: [any, ...any[]]) => {
    const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const tracer = trace.getTracer("nextbooru");

    return tracer.startActiveSpan("db.query", async (span) => {
      // Extract operation type from query for better span naming
      const operationType = queryText?.trim().split(/\s+/)[0]?.toUpperCase() || "UNKNOWN";
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("db.operation", operationType);

      const start = performance.now();
      try {
        const result = await originalQuery(...args);
        const duration = performance.now() - start;

        span.setAttribute("db.duration_ms", duration);
        span.setStatus({ code: SpanStatusCode.OK });

        if (enableQueryLog) {
          // Put formatted SQL in message (2nd arg) so pino-pretty renders newlines
          dbLog.debug({ duration: `${duration.toFixed(2)}ms` }, '\n' + formatSql(queryText || '', { language: 'postgresql' }));
        }

        return result;
      } catch (err) {
        const duration = performance.now() - start;
        span.setAttribute("db.duration_ms", duration);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));

        if (enableQueryLog) {
          dbLog.error(
            { duration: `${duration.toFixed(2)}ms`, error: err instanceof Error ? err.message : String(err) },
            'FAILED:\n' + formatSql(queryText || '', { language: 'postgresql' })
          );
        }

        throw err;
      } finally {
        span.end();
      }
    });
  };

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

/**
 * Get the total post count from Settings.
 * Initialized by migration, updated after each sync.
 */
export async function getTotalPostCount(): Promise<number> {
  const setting = await prisma.settings.findUnique({
    where: { key: "stats.totalPostCount" },
  });

  if (!setting) return 0;

  const parsed = parseInt(setting.value, 10);
  if (isNaN(parsed) || parsed < 0) {
    dbLog.error({ value: setting.value }, 'Invalid totalPostCount value, falling back to 0');
    return 0;
  }

  return parsed;
}

export default prisma;