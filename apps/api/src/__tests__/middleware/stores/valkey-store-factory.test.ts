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

  it("returns ValkeyRateLimitStore when connection succeeds", async () => {
    const fakeClient = { eval: vi.fn(), ping: vi.fn().mockResolvedValue("PONG") };

    vi.doMock("ioredis", () => ({
      default: class FakeRedis {
        eval = fakeClient.eval;
        ping = fakeClient.ping;
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

    expect(result).toBeInstanceOf(ValkeyRateLimitStore);
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
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});
