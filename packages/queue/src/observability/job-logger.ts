import type { Logger } from "@pluralscape/types";

/**
 * Writes structured JSON log lines to the console.
 * Intended for local development only — production code should inject
 * an application-level logger that writes to your observability stack.
 */
export class DevConsoleLogger implements Logger {
  info(message: string, data?: Record<string, unknown>): void {
    console.info(JSON.stringify({ level: "info", message, ...data }));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: "warn", message, ...data }));
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: "error", message, ...data }));
  }
}
