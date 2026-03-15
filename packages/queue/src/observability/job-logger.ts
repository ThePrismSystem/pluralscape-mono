export interface JobLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/** Writes structured JSON log lines to the console. */
export class ConsoleJobLogger implements JobLogger {
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
