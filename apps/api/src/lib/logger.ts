import pino from "pino";

/** Structured logger interface matching the (message, data?) signature. */
export interface AppLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

/** Minimal structural type for the subset of pino we use (avoids importing pino types). */
interface PinoInstance {
  info(msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  debug(msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;
  child(bindings: Record<string, unknown>): PinoInstance;
}

/**
 * Wraps a Pino logger instance into the AppLogger interface,
 * using the (message, data?) signature convention from JobLogger.
 */
function wrapPino(pinoInstance: PinoInstance): AppLogger {
  return {
    info(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pinoInstance.info(data, message);
      } else {
        pinoInstance.info(message);
      }
    },
    warn(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pinoInstance.warn(data, message);
      } else {
        pinoInstance.warn(message);
      }
    },
    error(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pinoInstance.error(data, message);
      } else {
        pinoInstance.error(message);
      }
    },
    debug(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pinoInstance.debug(data, message);
      } else {
        pinoInstance.debug(message);
      }
    },
  };
}

const DEFAULT_LOG_LEVEL = "info";

const pinoRoot: PinoInstance = pino({
  name: "pluralscape-api",
  level: process.env["LOG_LEVEL"] ?? DEFAULT_LOG_LEVEL,
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
export function getContextLogger(c: { get(key: string): unknown }): AppLogger {
  const log: unknown = c.get("log");
  if (log && typeof log === "object" && "error" in log) {
    return log as AppLogger;
  }
  return logger;
}
