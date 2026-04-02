import { describe, expect, it, vi } from "vitest";

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
const {
  createTRPCCategoryRateLimiter,
  createTRPCRateLimiter,
  ipKeyExtractor,
  accountKeyExtractor,
} = await import("../../../trpc/middlewares/rate-limit.js");
import { createCallerFactory, publicProcedure, router } from "../../../trpc/trpc.js";
import { makeContext, MOCK_AUTH } from "../test-helpers.js";

describe("ipKeyExtractor", () => {
  it("returns IP from requestMeta", () => {
    const key = ipKeyExtractor(
      { auth: null, requestMeta: { ipAddress: "1.2.3.4", userAgent: null } },
      undefined,
    );
    expect(key).toBe("1.2.3.4");
  });

  it("returns __global__ when IP is null", () => {
    const key = ipKeyExtractor(
      { auth: null, requestMeta: { ipAddress: null, userAgent: null } },
      undefined,
    );
    expect(key).toBe("__global__");
  });

  it("logs a warning when falling back to global key", async () => {
    vi.resetModules();
    vi.mock("../../../lib/logger.js", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.mock("../../../middleware/rate-limit.js", () => ({
      checkRateLimit: vi.fn(),
    }));
    const { logger } = await import("../../../lib/logger.js");
    const { ipKeyExtractor: freshExtractor } =
      await import("../../../trpc/middlewares/rate-limit.js");

    freshExtractor({ auth: null, requestMeta: { ipAddress: null, userAgent: null } }, undefined);
    expect(vi.mocked(logger)["warn"]).toHaveBeenCalledWith(expect.stringContaining("global"));
  });
});

describe("accountKeyExtractor", () => {
  it("returns accountId from auth context", () => {
    const key = accountKeyExtractor(
      { auth: MOCK_AUTH, requestMeta: { ipAddress: null, userAgent: null } },
      undefined,
    );
    expect(key).toBe(MOCK_AUTH.accountId);
  });

  it("throws UNAUTHORIZED when auth is null", () => {
    expect(() =>
      accountKeyExtractor(
        { auth: null, requestMeta: { ipAddress: null, userAgent: null } },
        undefined,
      ),
    ).toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
  });
});

describe("createTRPCRateLimiter", () => {
  it("allows requests under the limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCRateLimiter({
      limit: 10,
      windowMs: 60_000,
      keyPrefix: "test",
    });
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    const result = await caller.test();
    expect(result).toBe("ok");
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      expect.stringContaining("trpc:test:"),
      10,
      60_000,
    );
  });

  it("rejects requests over the limit with TOO_MANY_REQUESTS", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 30_000,
    });

    const limiter = createTRPCRateLimiter({
      limit: 10,
      windowMs: 60_000,
      keyPrefix: "test",
    });
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await expect(caller.test()).rejects.toThrow(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
    );
  });

  it("includes retry-after seconds in error message", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 45_000,
    });

    const limiter = createTRPCRateLimiter({
      limit: 5,
      windowMs: 60_000,
      keyPrefix: "retry",
    });
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await expect(caller.test()).rejects.toThrow(/45 seconds/);
  });
});

describe("createTRPCCategoryRateLimiter", () => {
  it("uses predefined RATE_LIMITS config for the given category", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCCategoryRateLimiter("readDefault");
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await caller.test();
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      expect.stringContaining("trpc:readDefault:"),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("uses readHeavy config for heavy read operations", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCCategoryRateLimiter("readHeavy");
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await caller.test();
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      expect.stringContaining("trpc:readHeavy:"),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("uses authHeavy config for auth operations", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCCategoryRateLimiter("authHeavy");
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await caller.test();
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      expect.stringContaining("trpc:authHeavy:"),
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe("createTRPCRateLimiter with custom keyExtractor", () => {
  it("uses custom keyExtractor when provided", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCRateLimiter({
      limit: 10,
      windowMs: 60_000,
      keyPrefix: "custom",
      keyExtractor: () => "custom-key-123",
    });
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(null));

    await caller.test();
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      "trpc:custom:custom-key-123",
      10,
      60_000,
    );
  });
});

describe("createTRPCRateLimiter with accountKeyExtractor", () => {
  it("uses accountId as rate-limit key", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const limiter = createTRPCRateLimiter({
      limit: 5,
      windowMs: 30_000,
      keyPrefix: "acct",
      keyExtractor: accountKeyExtractor,
    });
    const testRouter = router({
      test: publicProcedure.use(limiter).query(() => "ok"),
    });
    const createCaller = createCallerFactory(testRouter);
    const caller = createCaller(makeContext(MOCK_AUTH));

    await caller.test();
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith(
      `trpc:acct:${MOCK_AUTH.accountId}`,
      5,
      30_000,
    );
  });
});
