import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_LOGIN_MAX_ATTEMPTS,
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

  it("returns not-throttled for a fresh account", () => {
    const result = store.check("acct_1");
    expect(result.throttled).toBe(false);
    expect(result.failedAttempts).toBe(0);
  });

  it("increments failed attempts on recordFailure", () => {
    store.recordFailure("acct_1");
    const result = store.check("acct_1");
    expect(result.failedAttempts).toBe(1);
    expect(result.throttled).toBe(false);
  });

  it("throttles after max failed attempts", () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      store.recordFailure("acct_1");
    }
    const result = store.check("acct_1");
    expect(result.throttled).toBe(true);
    expect(result.failedAttempts).toBe(ACCOUNT_LOGIN_MAX_ATTEMPTS);
  });

  it("returns throttled from recordFailure at the threshold", () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS - 1; i++) {
      store.recordFailure("acct_1");
    }
    const result = store.recordFailure("acct_1");
    expect(result.throttled).toBe(true);
  });

  it("resets counter on reset()", () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      store.recordFailure("acct_1");
    }
    store.reset("acct_1");
    const result = store.check("acct_1");
    expect(result.throttled).toBe(false);
    expect(result.failedAttempts).toBe(0);
  });

  it("isolates throttle state between accounts", () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      store.recordFailure("acct_1");
    }
    const result = store.check("acct_2");
    expect(result.throttled).toBe(false);
  });

  it("expires the window after ACCOUNT_LOGIN_WINDOW_MS", () => {
    for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
      store.recordFailure("acct_1");
    }
    expect(store.check("acct_1").throttled).toBe(true);

    vi.advanceTimersByTime(ACCOUNT_LOGIN_WINDOW_MS);
    expect(store.check("acct_1").throttled).toBe(false);
    expect(store.check("acct_1").failedAttempts).toBe(0);
  });

  it("includes correct windowResetAt in results", () => {
    vi.setSystemTime(1_000_000);
    store.recordFailure("acct_1");
    const result = store.check("acct_1");
    expect(result.windowResetAt).toBe(1_000_000 + ACCOUNT_LOGIN_WINDOW_MS);
  });
});
