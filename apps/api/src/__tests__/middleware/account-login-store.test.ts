import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_LOGIN_MAX_ATTEMPTS,
  ACCOUNT_LOGIN_MAX_ENTRIES,
  ACCOUNT_LOGIN_WINDOW_MS,
  MemoryAccountLoginStore,
  _resetAccountLoginStoreForTesting,
} from "../../middleware/stores/account-login-store.js";

describe("MemoryAccountLoginStore", () => {
  let store: MemoryAccountLoginStore;

  beforeEach(() => {
    store = new MemoryAccountLoginStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetAccountLoginStoreForTesting();
  });

  it("returns not-throttled for a fresh key", async () => {
    const result = await store.check("acct_1");
    expect(result.throttled).toBe(false);
    expect(result.failedAttempts).toBe(0);
  });

  it("increments failed attempts on recordFailure", async () => {
    await store.recordFailure("acct_1");
    const result = await store.check("acct_1");
    expect(result.failedAttempts).toBe(1);
    expect(result.throttled).toBe(false);
  });

  it("throttles after max failed attempts", async () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      await store.recordFailure("acct_1");
    }
    const result = await store.check("acct_1");
    expect(result.throttled).toBe(true);
    expect(result.failedAttempts).toBe(ACCOUNT_LOGIN_MAX_ATTEMPTS);
  });

  it("returns throttled from recordFailure at the threshold", async () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS - 1; i++) {
      await store.recordFailure("acct_1");
    }
    const result = await store.recordFailure("acct_1");
    expect(result.throttled).toBe(true);
  });

  it("resets counter on reset()", async () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      await store.recordFailure("acct_1");
    }
    await store.reset("acct_1");
    const result = await store.check("acct_1");
    expect(result.throttled).toBe(false);
    expect(result.failedAttempts).toBe(0);
  });

  it("isolates throttle state between keys", async () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      await store.recordFailure("acct_1");
    }
    const result = await store.check("acct_2");
    expect(result.throttled).toBe(false);
  });

  it("expires the window after ACCOUNT_LOGIN_WINDOW_MS", async () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      await store.recordFailure("acct_1");
    }
    expect((await store.check("acct_1")).throttled).toBe(true);

    vi.advanceTimersByTime(ACCOUNT_LOGIN_WINDOW_MS);
    expect((await store.check("acct_1")).throttled).toBe(false);
    expect((await store.check("acct_1")).failedAttempts).toBe(0);
  });

  it("includes correct windowResetAt in results", async () => {
    vi.setSystemTime(1_000_000);
    await store.recordFailure("acct_1");
    const result = await store.check("acct_1");
    expect(result.windowResetAt).toBe(1_000_000 + ACCOUNT_LOGIN_WINDOW_MS);
  });

  it("force-evicts oldest non-expired entries when over capacity", async () => {
    vi.setSystemTime(1_000_000);

    // Fill to capacity + 2: evictIfNeeded runs before insert, so we need
    // store.size > MAX_ENTRIES when the last recordFailure checks. That
    // requires MAX_ENTRIES+1 entries already present, then one more call.
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ENTRIES + 2; i++) {
      // Advance time slightly so entries have distinct windowStart values
      vi.advanceTimersByTime(1);
      await store.recordFailure(`key_${String(i)}`);
    }

    // The oldest entry (key_0) should have been evicted
    const oldest = await store.check("key_0");
    expect(oldest.failedAttempts).toBe(0);

    // A newer entry should still be present
    const newer = await store.check(`key_${String(ACCOUNT_LOGIN_MAX_ENTRIES + 1)}`);
    expect(newer.failedAttempts).toBe(1);
  });
});
