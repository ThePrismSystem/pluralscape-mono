import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../lib/logger.js";
import {
  InMemoryValkeyCacheClient,
  InMemoryCacheForbiddenError,
  _resetInMemoryWarnForTesting,
  assertInMemoryCacheAllowed,
} from "../../lib/valkey-cache.js";

describe("assertInMemoryCacheAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws InMemoryCacheForbiddenError in production without opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "");

    expect(() => {
      assertInMemoryCacheAllowed("idempotency-store");
    }).toThrow(InMemoryCacheForbiddenError);
    expect(() => {
      assertInMemoryCacheAllowed("idempotency-store");
    }).toThrow(/idempotency-store/);
    expect(() => {
      assertInMemoryCacheAllowed("idempotency-store");
    }).toThrow(/ALLOW_IN_MEMORY_CACHE=1/);
  });

  it("returns silently in production with ALLOW_IN_MEMORY_CACHE=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "1");

    expect(() => {
      assertInMemoryCacheAllowed("rate-limit-store");
    }).not.toThrow();
  });

  it("returns silently outside production even without opt-in", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "");

    expect(() => {
      assertInMemoryCacheAllowed("sync-pubsub");
    }).not.toThrow();
  });
});

describe("InMemoryValkeyCacheClient warn-once", () => {
  afterEach(() => {
    _resetInMemoryWarnForTesting();
    vi.restoreAllMocks();
  });

  it("emits the fallback warning exactly once per process", () => {
    const spy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    _resetInMemoryWarnForTesting();

    new InMemoryValkeyCacheClient();
    new InMemoryValkeyCacheClient();
    new InMemoryValkeyCacheClient();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain("falling back to per-process in-memory cache");
  });
});
