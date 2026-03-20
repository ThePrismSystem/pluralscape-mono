import pino from "pino";

import { env } from "../env.js";

/** Branded symbol for safe type narrowing in getContextLogger. */
export const APP_LOGGER_BRAND: unique symbol = Symbol("AppLogger");

/** Structured logger interface matching the (message, data?) signature. */
export interface AppLogger {
  readonly [APP_LOGGER_BRAND]: true;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

type LogLevel = "info" | "warn" | "error" | "debug";

/** Creates a single log method that delegates to the pino instance with swapped arg order. */
function wrapLevel(
  pinoInstance: pino.Logger,
  level: LogLevel,
): (message: string, data?: Record<string, unknown>) => void {
  return (message: string, data?: Record<string, unknown>): void => {
    if (data) {
      pinoInstance[level](data, message);
    } else {
      pinoInstance[level](message);
    }
  };
}

/**
 * Wraps a Pino logger instance into the AppLogger interface,
 * using the (message, data?) signature convention from Logger.
 */
function wrapPino(pinoInstance: pino.Logger): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: wrapLevel(pinoInstance, "info"),
    warn: wrapLevel(pinoInstance, "warn"),
    error: wrapLevel(pinoInstance, "error"),
    debug: wrapLevel(pinoInstance, "debug"),
  };
}

const pinoRoot: pino.Logger = pino({
  name: "pluralscape-api",
  level: env.LOG_LEVEL,
});

/** Root application logger. */
export const logger: AppLogger = wrapPino(pinoRoot);

/** Creates a child logger with the given requestId bound to every log line. */
export function createRequestLogger(requestId: string): AppLogger {
  return wrapPino(pinoRoot.child({ requestId }));
}

/**
 * Safely extracts the request-scoped logger from any Hono context.
 * Falls back to the root logger if the context doesn't have one.
 */
export function getContextLogger(c: { get(key: "log"): unknown }): AppLogger {
  const log: unknown = c.get("log");
  if (log && typeof log === "object" && APP_LOGGER_BRAND in log) {
    return log as AppLogger;
  }
  return logger;
}
