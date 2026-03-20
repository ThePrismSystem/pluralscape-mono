/**
 * Per-account login throttle store.
 * Tracks failed login attempts per key (emailHash) within a fixed time window.
 */

/** Maximum failed login attempts before throttling kicks in. */
export const ACCOUNT_LOGIN_MAX_ATTEMPTS = 10;

/** Throttle window duration in milliseconds (15 minutes). */
export const ACCOUNT_LOGIN_WINDOW_MS = 900_000;

/** Maximum entries before eviction sweep. */
export const ACCOUNT_LOGIN_MAX_ENTRIES = 10_000;

export interface LoginThrottleEntry {
  failedAttempts: number;
  windowStart: number;
}

export interface LoginThrottleResult {
  /** Whether the account is currently throttled. */
  readonly throttled: boolean;
  /** Number of failed attempts in the current window. */
  readonly failedAttempts: number;
  /** When the current window resets (UnixMillis). */
  readonly windowResetAt: number;
}

/** Store for tracking per-key login failures. */
export interface AccountLoginStore {
  /** Check whether the key is throttled. Does NOT increment. */
  check(key: string): Promise<LoginThrottleResult>;
  /** Record a failed login attempt. Returns updated state. */
  recordFailure(key: string): Promise<LoginThrottleResult>;
  /** Reset the failure counter (e.g. on successful login). */
  reset(key: string): Promise<void>;
}

/** In-memory implementation of the login throttle store. */
export class MemoryAccountLoginStore implements AccountLoginStore {
  private readonly store = new Map<string, LoginThrottleEntry>();

  check(key: string): Promise<LoginThrottleResult> {
    const now = Date.now();
    const entry = this.getOrExpire(key, now);
    if (!entry) {
      return Promise.resolve({
        throttled: false,
        failedAttempts: 0,
        windowResetAt: now + ACCOUNT_LOGIN_WINDOW_MS,
      });
    }
    return Promise.resolve({
      throttled: entry.failedAttempts >= ACCOUNT_LOGIN_MAX_ATTEMPTS,
      failedAttempts: entry.failedAttempts,
      windowResetAt: entry.windowStart + ACCOUNT_LOGIN_WINDOW_MS,
    });
  }

  recordFailure(key: string): Promise<LoginThrottleResult> {
    const now = Date.now();
    this.evictIfNeeded(now);
    let entry = this.getOrExpire(key, now);
    if (!entry) {
      entry = { failedAttempts: 0, windowStart: now };
      this.store.set(key, entry);
    }
    entry.failedAttempts++;
    return Promise.resolve({
      throttled: entry.failedAttempts >= ACCOUNT_LOGIN_MAX_ATTEMPTS,
      failedAttempts: entry.failedAttempts,
      windowResetAt: entry.windowStart + ACCOUNT_LOGIN_WINDOW_MS,
    });
  }

  reset(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  private getOrExpire(key: string, now: number): LoginThrottleEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (now - entry.windowStart >= ACCOUNT_LOGIN_WINDOW_MS) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private evictIfNeeded(now: number): void {
    if (this.store.size <= ACCOUNT_LOGIN_MAX_ENTRIES) return;

    // First pass: remove expired entries
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= ACCOUNT_LOGIN_WINDOW_MS) {
        this.store.delete(key);
      }
    }

    // Second pass: if still over capacity, force-evict oldest by windowStart
    if (this.store.size > ACCOUNT_LOGIN_MAX_ENTRIES) {
      const sorted = [...this.store.entries()].sort(
        ([, a], [, b]) => a.windowStart - b.windowStart,
      );
      const toRemove = this.store.size - ACCOUNT_LOGIN_MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        const entry = sorted[i];
        if (entry) {
          this.store.delete(entry[0]);
        }
      }
    }
  }
}

/** Shared singleton for the login throttle store. */
let sharedLoginStore: AccountLoginStore | undefined;

/** Set the shared login throttle store (call at startup). */
export function setAccountLoginStore(store: AccountLoginStore): void {
  sharedLoginStore = store;
}

/** Get the shared login throttle store. Falls back to in-memory if not set. */
export function getAccountLoginStore(): AccountLoginStore {
  sharedLoginStore ??= new MemoryAccountLoginStore();
  return sharedLoginStore;
}

/** Reset the shared store (for testing). */
export function _resetAccountLoginStoreForTesting(): void {
  sharedLoginStore = undefined;
}
