/**
 * Tests for M1: Per-account SSE connection limit.
 *
 * Verifies that accounts are limited to SSE_MAX_CONNECTIONS_PER_ACCOUNT
 * concurrent SSE streams.
 */
import { describe, expect, it, afterEach } from "vitest";

import { SSE_MAX_CONNECTIONS_PER_ACCOUNT } from "../../lib/sse.constants.js";
import {
  getAccountSseStreamCount,
  _resetSseStateForTesting,
  _addMockStreamForTesting,
} from "../../routes/notifications/stream.js";

describe("SSE connection limit", () => {
  afterEach(() => {
    _resetSseStateForTesting();
  });

  it("exports the expected max connections per account constant", () => {
    expect(SSE_MAX_CONNECTIONS_PER_ACCOUNT).toBe(5);
  });

  it("allows connections up to the limit", () => {
    const accountId = crypto.randomUUID();
    for (let i = 0; i < SSE_MAX_CONNECTIONS_PER_ACCOUNT; i++) {
      _addMockStreamForTesting(accountId);
    }
    expect(getAccountSseStreamCount(accountId)).toBe(SSE_MAX_CONNECTIONS_PER_ACCOUNT);
  });

  it("reports correct stream count per account", () => {
    const accountId = crypto.randomUUID();
    expect(getAccountSseStreamCount(accountId)).toBe(0);

    _addMockStreamForTesting(accountId);
    expect(getAccountSseStreamCount(accountId)).toBe(1);

    _addMockStreamForTesting(accountId);
    expect(getAccountSseStreamCount(accountId)).toBe(2);
  });

  it("tracks streams independently per account", () => {
    const account1 = crypto.randomUUID();
    const account2 = crypto.randomUUID();

    _addMockStreamForTesting(account1);
    _addMockStreamForTesting(account1);
    _addMockStreamForTesting(account2);

    expect(getAccountSseStreamCount(account1)).toBe(2);
    expect(getAccountSseStreamCount(account2)).toBe(1);
  });
});
