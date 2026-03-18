import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createValkeyStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns ValkeyRateLimitStore when connection succeeds", async () => {
    const fakeClient = { eval: vi.fn() };

    vi.doMock("ioredis", () => {
      function FakeRedis() {
        return fakeClient;
      }
      return { default: FakeRedis };
    });

    const { createValkeyStore, ValkeyRateLimitStore } =
      await import("../../../middleware/stores/valkey-store.js");

    const result = await createValkeyStore("redis://localhost:6379");

    expect(result).toBeInstanceOf(ValkeyRateLimitStore);
  });

  it("returns null when connection fails", async () => {
    vi.doMock("ioredis", () => {
      throw new Error("Cannot find module 'ioredis'");
    });

    const { createValkeyStore } = await import("../../../middleware/stores/valkey-store.js");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createValkeyStore("redis://localhost:6379");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to connect to Valkey"),
      expect.any(Error),
    );
  });
});
