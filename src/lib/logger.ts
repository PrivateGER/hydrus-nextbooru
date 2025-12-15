import pino from "pino";
import pretty from "pino-pretty";

const isDev = process.env.NODE_ENV === "development";

/**
 * Application logger using pino.
 *
 * In development: pretty-printed, colorized output via stream
 * In production: JSON logs for aggregation
 *
 * Note: Uses pino-pretty as a stream (not transport) to avoid worker thread
 * issues with Next.js bundling.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   const log = logger.child({ module: "wildcard" });
 *   log.debug({ pattern, sqlPattern }, "Resolving wildcard");
 */
const stream = isDev
  ? pretty({
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss",
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  },
  stream
);

/**
 * Create a child logger for a specific module/namespace.
 *
 * @param module - The module name (e.g., "wildcard", "sync", "api")
 * @returns A child logger with the module context
 */
export function createLogger(module: string) {
  return logger.child({ module });
}

// Pre-configured loggers for common modules
export const wildcardLog = createLogger("wildcard");
export const dbLog = createLogger("db");
export const apiLog = createLogger("api");
export const syncLog = createLogger("sync");
