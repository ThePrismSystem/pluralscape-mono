import type { Logger } from "@pluralscape/types";

export type MobileLoggerPayload = Record<string, unknown>;

/**
 * Key-name substrings that cause a value to be replaced with `"[redacted]"`
 * by {@link defaultRedact}. Matched case-insensitively anywhere in the key.
 */
export const DEFAULT_REDACT_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authorization",
  "secret",
  "privateKey",
  "recoveryKey",
  "email",
  "pepper",
] as const;

const REDACT_PLACEHOLDER = "[redacted]";
const UNSERIALIZABLE_PLACEHOLDER = "[unserializable]";

export interface MobileLoggerOptions {
  /**
   * Payload transform applied before serialization.
   *
   * - Omitted → {@link defaultRedact} runs (recursive PII masking).
   * - A function → custom redactor, fully replaces the default.
   * - `null` → explicit opt-out, payload passes through untouched. Use only
   *   when the caller has already sanitized values.
   */
  readonly redact?: ((payload: MobileLoggerPayload) => MobileLoggerPayload) | null;
  /**
   * Console implementation to log through. Defaults to `globalThis.console`.
   * Override in tests with a captured-calls double.
   */
  readonly console?: Pick<Console, "info" | "warn" | "error">;
}

/**
 * Recursively mask values under PII-adjacent keys. Case-insensitive substring
 * match against {@link DEFAULT_REDACT_KEYS}. Cycles are broken via a
 * `WeakSet` guard so this never throws on self-referential payloads.
 */
export function defaultRedact(payload: MobileLoggerPayload): MobileLoggerPayload {
  const seen = new WeakSet();
  return walk(payload, seen) as MobileLoggerPayload;
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[cycle]";
    seen.add(value);
    return value.map((item) => walk(item, seen));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[cycle]";
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = shouldRedact(key) ? REDACT_PLACEHOLDER : walk(obj[key], seen);
    }
    return out;
  }
  return value;
}

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  for (const candidate of DEFAULT_REDACT_KEYS) {
    if (lower.includes(candidate.toLowerCase())) return true;
  }
  return false;
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
  const redact =
    options.redact === null
      ? (payload: MobileLoggerPayload): MobileLoggerPayload => payload
      : (options.redact ?? defaultRedact);
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
  let serialized: string;
  try {
    serialized = JSON.stringify(redacted);
  } catch {
    serialized = UNSERIALIZABLE_PLACEHOLDER;
  }
  return `${message} ${serialized}`;
}
