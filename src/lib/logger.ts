import pino from "pino";
import pretty from "pino-pretty";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/**
 * Application logger using pino.
 *
 * Pretty-printed output in both dev and production.
 * Colorized in development only.
 *
 * Note: Uses pino-pretty as a stream (not transport) to avoid worker thread
 * issues with Next.js bundling.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   const log = logger.child({ module: "wildcard" });
 *   log.debug({ pattern, sqlPattern }, "Resolving wildcard");
 */
const stream = pretty({
  colorize: isDev,
  ignore: "pid,hostname",
  translateTime: "HH:MM:ss",
  messageKey: "msg", // ensures newlines in messages render correctly
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isTest ? "silent" : isDev ? "debug" : "info"),
  },
  stream
);

/**
 * Create a child logger for a specific module/namespace.
 *
 * @param module - The module name (e.g., "wildcard", "sync", "api")
 * @returns A child logger with the module context
 */
export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}

// Pre-configured loggers for common modules
export const wildcardLog = createLogger("wildcard");
export const dbLog = createLogger("db");
export const apiLog = createLogger("api");
export const syncLog = createLogger("sync");
export const hydrusLog = createLogger("hydrus");
export const thumbnailLog = createLogger("thumbnail");
export const fileLog = createLogger("file");
export const aiLog = createLogger("ai");
