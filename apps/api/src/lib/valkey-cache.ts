import { logger } from "./logger.js";

/**
 * Raised when a Valkey-backed consumer tries to fall back to an in-memory
 * store in NODE_ENV=production without ALLOW_IN_MEMORY_CACHE=1. Exported so
 * callers can narrow in tests.
 */
export class InMemoryCacheForbiddenError extends Error {
  constructor(consumerName: string) {
    super(
      `valkey-cache: ${consumerName} refuses to fall back to in-memory in NODE_ENV=production. ` +
        "Configure a shared Valkey/Redis endpoint, or set ALLOW_IN_MEMORY_CACHE=1 to explicitly " +
        "opt in to per-process caching (only safe for single-instance deployments).",
    );
    this.name = "InMemoryCacheForbiddenError";
  }
}

/**
 * Fail-closed production gate for Valkey-backed consumers.
 *
 * Throws {@link InMemoryCacheForbiddenError} in NODE_ENV=production unless
 * ALLOW_IN_MEMORY_CACHE=1 is set. Callers invoke this BEFORE falling back to
 * an in-memory implementation so operators see an actionable error at boot,
 * not silent drift at runtime.
 */
export function assertInMemoryCacheAllowed(consumerName: string): void {
  if (process.env["NODE_ENV"] !== "production") return;
  if (process.env["ALLOW_IN_MEMORY_CACHE"] === "1") return;
  throw new InMemoryCacheForbiddenError(consumerName);
}

/**
 * Minimal Valkey/Redis client surface required by ValkeyCache.
 * Matches ioredis' `set(key, value, "PX", ttlMs)` overload for TTL writes.
 */
export interface ValkeyCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<"OK" | null>;
  del(key: string): Promise<number>;
}

/**
 * Generic namespaced JSON cache backed by a Valkey/Redis client.
 *
 * Every key is prefixed with `{namespace}:` so unrelated caches can coexist
 * on a single shared client without collision risk. Parse failures are
 * treated as misses — a corrupted entry never propagates as an error
 * because stale/garbled cache data must never break a live request.
 */
export class ValkeyCache {
  constructor(
    private readonly client: ValkeyCacheClient,
    private readonly namespace: string,
  ) {}

  private key(k: string): string {
    return `${this.namespace}:${k}`;
  }

  async getJSON<T>(k: string): Promise<T | null> {
    const prefixed = this.key(k);
    const raw = await this.client.get(prefixed);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      // Evict the corrupt entry so subsequent reads don't re-hit the same
      // unparseable payload indefinitely — a poisoned cache value must not
      // outlive a single failed parse.
      logger.warn("valkey-cache: failed to parse JSON; evicting corrupt entry", {
        key: prefixed,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.client.del(prefixed);
      return null;
    }
  }

  async setJSON(k: string, value: unknown, ttlMs: number): Promise<void> {
    await this.client.set(this.key(k), JSON.stringify(value), "PX", ttlMs);
  }

  /**
   * Write JSON best-effort. Logs and swallows failures so a transient Valkey
   * disconnect after a fresh upstream fetch doesn't fail the live request.
   *
   * Use this when the cache is an optimization (read-through proxy with a
   * fresh upstream result already in hand), not when the cache is the source
   * of truth — a silent failure there would mask real bugs.
   */
  async trySetJSON(k: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.setJSON(k, value, ttlMs);
    } catch (error: unknown) {
      logger.warn("valkey-cache: setJSON failed, continuing", {
        key: this.key(k),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async delete(k: string): Promise<void> {
    await this.client.del(this.key(k));
  }
}

/**
 * Module-scope gate so the fallback warning fires at most once per process,
 * even when callers construct several clients (test harnesses, per-consumer
 * wiring). Operators only need to see the signal once.
 */
let hasWarnedInMemoryFallback = false;

/**
 * Test-only: reset the warn-once gate so each test can assert the first
 * emission independently. Not exported from the package boundary.
 */
export function _resetInMemoryWarnForTesting(): void {
  hasWarnedInMemoryFallback = false;
}

/**
 * In-memory `ValkeyCacheClient` with TTL support.
 *
 * Used as a fallback when Valkey isn't configured — keeps the API usable in
 * single-instance deployments (and E2E) without forcing an external Valkey
 * dependency. TTL is tracked per-entry and enforced lazily on `get`.
 *
 * Not intended for multi-instance production: two API replicas running this
 * would serve divergent cached values. Production deployments should wire a
 * real Valkey via `VALKEY_URL` so rate limiting, idempotency, and i18n cache
 * all share coherent state.
 */
export class InMemoryValkeyCacheClient implements ValkeyCacheClient {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    if (!hasWarnedInMemoryFallback) {
      hasWarnedInMemoryFallback = true;
      logger.warn(
        "valkey-cache: falling back to per-process in-memory cache — " +
          "safe for single-instance deployments and E2E, NOT safe for multi-replica production. " +
          "Set VALKEY_URL to a real Valkey/Redis endpoint to share cache state across instances.",
      );
    }
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, _mode: "PX", ttlMs: number): Promise<"OK" | null> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return Promise.resolve("OK");
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }
}
