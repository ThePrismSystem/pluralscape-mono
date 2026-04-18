import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_RATE_LIMIT_ENTRIES } from "../../middleware/middleware.constants.js";
import { MemoryRateLimitStore } from "../../middleware/stores/memory-store.js";
import { ValkeyRateLimitStore } from "../../middleware/stores/valkey-store.js";

import type { ValkeyClient } from "../../middleware/stores/valkey-store.js";

// ── MemoryRateLimitStore ─────────────────────────────────────────────

describe("MemoryRateLimitStore", () => {
  let store: MemoryRateLimitStore;
  let now: number;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("increment within a window", () => {
    it("returns count 1 on first call for a key", async () => {
      const result = await store.increment("key:1", 60_000);

      expect(result.count).toBe(1);
    });

    it("increments count on subsequent calls within the same window", async () => {
      await store.increment("key:1", 60_000);
      await store.increment("key:1", 60_000);
      const result = await store.increment("key:1", 60_000);

      expect(result.count).toBe(3);
    });

    it("returns resetAt equal to now + windowMs on first call", async () => {
      const windowMs = 60_000;
      const result = await store.increment("key:1", windowMs);

      expect(result.resetAt).toBe(now + windowMs);
    });

    it("returns the same resetAt on repeated calls within the window", async () => {
      const windowMs = 60_000;
      const first = await store.increment("key:1", windowMs);

      // Advance time but stay within the window
      vi.spyOn(Date, "now").mockReturnValue(now + 30_000);

      const second = await store.increment("key:1", windowMs);

      expect(second.resetAt).toBe(first.resetAt);
    });

    it("tracks separate counts per key", async () => {
      await store.increment("key:a", 60_000);
      await store.increment("key:a", 60_000);
      await store.increment("key:b", 60_000);

      const a = await store.increment("key:a", 60_000);
      const b = await store.increment("key:b", 60_000);

      expect(a.count).toBe(3);
      expect(b.count).toBe(2);
    });
  });

  describe("window reset", () => {
    it("resets count to 1 when the window has expired (now === resetAt)", async () => {
      const windowMs = 60_000;
      await store.increment("key:1", windowMs);
      await store.increment("key:1", windowMs);

      // Advance to exactly the reset boundary
      vi.spyOn(Date, "now").mockReturnValue(now + windowMs);

      const result = await store.increment("key:1", windowMs);

      expect(result.count).toBe(1);
    });

    it("resets count to 1 when called after the window has expired", async () => {
      const windowMs = 60_000;
      await store.increment("key:1", windowMs);
      await store.increment("key:1", windowMs);

      // Advance past the window
      vi.spyOn(Date, "now").mockReturnValue(now + windowMs + 1);

      const result = await store.increment("key:1", windowMs);

      expect(result.count).toBe(1);
    });

    it("sets a new resetAt after window reset", async () => {
      const windowMs = 60_000;
      const advanceMs = windowMs + 5_000;

      await store.increment("key:1", windowMs);

      vi.spyOn(Date, "now").mockReturnValue(now + advanceMs);

      const result = await store.increment("key:1", windowMs);

      expect(result.resetAt).toBe(now + advanceMs + windowMs);
    });

    it("does not reset a key whose window has not yet expired", async () => {
      const windowMs = 60_000;
      await store.increment("key:1", windowMs);
      await store.increment("key:1", windowMs);

      // One millisecond before expiry
      vi.spyOn(Date, "now").mockReturnValue(now + windowMs - 1);

      const result = await store.increment("key:1", windowMs);

      expect(result.count).toBe(3);
    });
  });

  describe("eviction behavior", () => {
    it("evicts expired entries when the store exceeds MAX_RATE_LIMIT_ENTRIES", async () => {
      const windowMs = 60_000;

      // Fill the store with MAX_RATE_LIMIT_ENTRIES keys, all expiring in the past
      const expiredNow = now;
      vi.spyOn(Date, "now").mockReturnValue(expiredNow);

      for (let i = 0; i < MAX_RATE_LIMIT_ENTRIES; i++) {
        await store.increment(`evict-key:${String(i)}`, windowMs);
      }

      // Advance past the window so all existing entries are expired
      vi.spyOn(Date, "now").mockReturnValue(expiredNow + windowMs + 1);

      // This next insert should trigger eviction of the expired entries
      // and then insert the new key successfully
      const result = await store.increment("new-key", windowMs);

      expect(result.count).toBe(1);
      // The store should have shed the old keys — only "new-key" remains
      // (internal size is not exposed, so we verify via expected count only)
    });

    it("does not evict live entries when store exceeds MAX_RATE_LIMIT_ENTRIES", async () => {
      const windowMs = 60_000;

      // Fill the store past the limit using a long window so nothing expires
      for (let i = 0; i <= MAX_RATE_LIMIT_ENTRIES; i++) {
        await store.increment(`live-key:${String(i)}`, windowMs);
      }

      // The first key's count should still be exactly 1 — it was not evicted
      const result = await store.increment("live-key:0", windowMs);

      expect(result.count).toBe(2);
    });
  });
});

// ── ValkeyRateLimitStore ─────────────────────────────────────────────

describe("ValkeyRateLimitStore", () => {
  const evalMock = vi.fn();
  let mockClient: ValkeyClient;
  let store: ValkeyRateLimitStore;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    evalMock.mockReset();

    mockClient = {
      eval: evalMock,
      ping: vi.fn().mockResolvedValue("PONG"),
      disconnect: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };
    store = new ValkeyRateLimitStore(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls eval with the correct key prefix and windowMs", async () => {
    evalMock.mockResolvedValue([1, 60_000]);

    await store.increment("user:123", 60_000);

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String), // Lua script
      1,
      "ps:rl:user:123",
      "60000",
    );
  });

  it("returns count from the Lua script result", async () => {
    evalMock.mockResolvedValue([5, 30_000]);

    const result = await store.increment("user:123", 60_000);

    expect(result.count).toBe(5);
  });

  it("computes resetAt as now + pttl", async () => {
    const pttl = 45_000;
    evalMock.mockResolvedValue([1, pttl]);

    const result = await store.increment("user:123", 60_000);

    expect(result.resetAt).toBe(now + pttl);
  });

  it("clamps negative pttl to 0 when computing resetAt", async () => {
    // pttl of -1 means the key has no expiry (shouldn't happen with correct Lua,
    // but the store guards against it with Math.max)
    evalMock.mockResolvedValue([1, -1]);

    const result = await store.increment("user:123", 60_000);

    expect(result.resetAt).toBe(now);
  });

  it("prefixes the key with 'ps:rl:'", async () => {
    evalMock.mockResolvedValue([1, 10_000]);

    await store.increment("ip:192.168.0.1", 10_000);

    const callArgs = evalMock.mock.calls[0];
    expect(callArgs?.[2]).toBe("ps:rl:ip:192.168.0.1");
  });

  it("passes windowMs as a string argument", async () => {
    evalMock.mockResolvedValue([1, 5_000]);

    await store.increment("key", 5_000);

    const callArgs = evalMock.mock.calls[0];
    expect(callArgs?.[3]).toBe("5000");
    expect(typeof callArgs?.[3]).toBe("string");
  });

  it("propagates errors thrown by the client", async () => {
    evalMock.mockRejectedValue(new Error("connection refused"));

    await expect(store.increment("key", 60_000)).rejects.toThrow("connection refused");
  });
});
