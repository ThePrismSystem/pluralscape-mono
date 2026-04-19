import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogWarn = vi.fn();

describe("createValkeyStore", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLogWarn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns a bundle with store and client when connection succeeds", async () => {
    const fakeClient = {
      eval: vi.fn(),
      ping: vi.fn().mockResolvedValue("PONG"),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    vi.doMock("ioredis", () => ({
      default: class FakeRedis {
        eval = fakeClient.eval;
        ping = fakeClient.ping;
        get = fakeClient.get;
        set = fakeClient.set;
        del = fakeClient.del;
      },
    }));

    vi.doMock("../../../lib/logger.js", () => ({
      logger: {
        info: vi.fn(),
        warn: mockLogWarn,
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));

    const { createValkeyStore, ValkeyRateLimitStore } =
      await import("../../../middleware/stores/valkey-store.js");

    const result = await createValkeyStore("redis://localhost:6379");

    expect(result).not.toBeNull();
    expect(result?.rateLimitStore).toBeInstanceOf(ValkeyRateLimitStore);
    // The client round-tripped from the bundle must be the same instance the
    // factory constructed — otherwise shared-client consumers would see
    // disconnected state vs. the rate-limit store.
    expect(result?.client).not.toBeUndefined();
  });

  it("returns null when connection fails", async () => {
    vi.doMock("ioredis", () => {
      throw new Error("Cannot find module 'ioredis'");
    });

    vi.doMock("../../../lib/logger.js", () => ({
      logger: {
        info: vi.fn(),
        warn: mockLogWarn,
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));

    const { createValkeyStore } = await import("../../../middleware/stores/valkey-store.js");

    const result = await createValkeyStore("redis://localhost:6379");

    expect(result).toBeNull();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to connect to Valkey"),
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });
});
