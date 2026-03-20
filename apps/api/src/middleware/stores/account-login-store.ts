/**
 * Per-account login throttle store.
 * Tracks failed login attempts per account ID within a fixed time window.
 */

/** Maximum failed login attempts before throttling kicks in. */
export const ACCOUNT_LOGIN_MAX_ATTEMPTS = 10;

/** Throttle window duration in milliseconds (15 minutes). */
export const ACCOUNT_LOGIN_WINDOW_MS = 900_000;

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

/** Store for tracking per-account login failures. */
export interface AccountLoginStore {
  /** Check whether the account is throttled. Does NOT increment. */
  check(accountId: string): LoginThrottleResult;
  /** Record a failed login attempt. Returns updated state. */
  recordFailure(accountId: string): LoginThrottleResult;
  /** Reset the failure counter (e.g. on successful login). */
  reset(accountId: string): void;
}

/** Maximum entries before eviction sweep. */
const MAX_ENTRIES = 10_000;

/** In-memory implementation of the login throttle store. */
export class MemoryAccountLoginStore implements AccountLoginStore {
  private readonly store = new Map<string, LoginThrottleEntry>();

  check(accountId: string): LoginThrottleResult {
    const now = Date.now();
    const entry = this.getOrExpire(accountId, now);
    if (!entry) {
      return { throttled: false, failedAttempts: 0, windowResetAt: now + ACCOUNT_LOGIN_WINDOW_MS };
    }
    return {
      throttled: entry.failedAttempts >= ACCOUNT_LOGIN_MAX_ATTEMPTS,
      failedAttempts: entry.failedAttempts,
      windowResetAt: entry.windowStart + ACCOUNT_LOGIN_WINDOW_MS,
    };
  }

  recordFailure(accountId: string): LoginThrottleResult {
    const now = Date.now();
    this.evictIfNeeded(now);
    let entry = this.getOrExpire(accountId, now);
    if (!entry) {
      entry = { failedAttempts: 0, windowStart: now };
      this.store.set(accountId, entry);
    }
    entry.failedAttempts++;
    return {
      throttled: entry.failedAttempts >= ACCOUNT_LOGIN_MAX_ATTEMPTS,
      failedAttempts: entry.failedAttempts,
      windowResetAt: entry.windowStart + ACCOUNT_LOGIN_WINDOW_MS,
    };
  }

  reset(accountId: string): void {
    this.store.delete(accountId);
  }

  private getOrExpire(accountId: string, now: number): LoginThrottleEntry | undefined {
    const entry = this.store.get(accountId);
    if (!entry) return undefined;
    if (now - entry.windowStart >= ACCOUNT_LOGIN_WINDOW_MS) {
      this.store.delete(accountId);
      return undefined;
    }
    return entry;
  }

  private evictIfNeeded(now: number): void {
    if (this.store.size <= MAX_ENTRIES) return;
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= ACCOUNT_LOGIN_WINDOW_MS) {
        this.store.delete(key);
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
