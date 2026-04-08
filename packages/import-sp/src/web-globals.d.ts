/**
 * Ambient declarations for the Web Platform globals used by the Simply Plural
 * import engine. The monorepo's base tsconfig intentionally omits the DOM lib,
 * so packages that rely on `fetch`, `AbortController`, and related types must
 * declare the subset they use.
 *
 * These APIs are available at runtime on every target platform:
 * - Node 18+ (via undici)
 * - Bun
 * - React Native 0.73+ (via whatwg-fetch polyfill) and Expo
 * - Modern browsers
 *
 * Only the subset consumed by `api-source.ts` and related files is declared.
 * Additional members can be added as other files require them.
 */

// ── HTTP primitives ────────────────────────────────────────────────────────────

/** A name/value map for HTTP headers. */
type HeadersInit = Record<string, string>;

/** Init options for a `Request` or a `fetch()` call. */
interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array | null;
  signal?: AbortSignal;
}

/** Init options for constructing a `Response`. */
interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

/**
 * Minimal surface of the Fetch API `Response` type. Only the members used by
 * the import sources are declared.
 */
declare class Response {
  constructor(body?: string | Uint8Array | null, init?: ResponseInit);
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Minimal `AbortSignal` surface. */
declare class AbortSignal {
  readonly aborted: boolean;
}

/** Minimal `AbortController` surface. */
declare class AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

/** The Fetch API entrypoint. */
declare function fetch(input: string, init?: RequestInit): Promise<Response>;

// ── Timer primitives ───────────────────────────────────────────────────────────

/**
 * Cross-runtime timer handle. Node returns an object, browsers return a
 * number — callers treat it as an opaque value via this branded interface so
 * neither runtime shape leaks into application code.
 */
interface TimerHandle {
  readonly _timerBrand: unique symbol;
}

declare function setTimeout(handler: () => void, timeout: number): TimerHandle;
declare function clearTimeout(handle: TimerHandle): void;
