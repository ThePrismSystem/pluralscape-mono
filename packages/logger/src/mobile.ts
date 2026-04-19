import type { Logger } from "@pluralscape/types";

export type MobileLoggerPayload = Record<string, unknown>;

export interface MobileLoggerOptions {
  /**
   * Optional payload transform applied before the structured payload is
   * serialized. Useful for redacting PII keys. Receives the caller's
   * payload and returns a sanitized copy; the hook must be pure.
   */
  readonly redact?: (payload: MobileLoggerPayload) => MobileLoggerPayload;
  /**
   * Console implementation to log through. Defaults to `globalThis.console`.
   * Override in tests with a captured-calls double.
   */
  readonly console?: Pick<Console, "info" | "warn" | "error">;
}

/**
 * Build a `Logger` implementation for React Native / Expo.
 *
 * Wraps `globalThis.console.{info,warn,error}` so structured payloads reach
 * the device log stream (visible to `npx react-native log-ios|log-android`,
 * Metro, and Hermes trace tooling) in a format that stays grep-able.
 *
 * The API runtime (Bun/Node) has its own logger at `apps/api/src/lib/logger.ts`;
 * this factory is the counterpart for mobile. Web will get a sibling
 * `createWebLogger` when the web app lands.
 */
export function createMobileLogger(options: MobileLoggerOptions = {}): Logger {
  const redact = options.redact ?? ((payload) => payload);
  const target = options.console ?? globalThis.console;

  return {
    info(message: string, data?: MobileLoggerPayload): void {
      target.info(format(message, data, redact));
    },
    warn(message: string, data?: MobileLoggerPayload): void {
      target.warn(format(message, data, redact));
    },
    error(message: string, data?: MobileLoggerPayload): void {
      target.error(format(message, data, redact));
    },
  };
}

function format(
  message: string,
  payload: MobileLoggerPayload | undefined,
  redact: (payload: MobileLoggerPayload) => MobileLoggerPayload,
): string {
  if (payload === undefined) return message;
  const redacted = redact(payload);
  return `${message} ${JSON.stringify(redacted)}`;
}
