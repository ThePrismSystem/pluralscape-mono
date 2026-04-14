import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

// Mock modules that transitively import react-native (unsupported in Node/vitest).
// @pluralscape/api-client/trpc → @trpc/react-query
// ../config.js → expo-constants → react-native
vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: { createClient: vi.fn(), Provider: vi.fn() },
  MAX_URL_LENGTH: 2083,
  MAX_BATCH_ITEMS: 10,
}));
vi.mock("../../config.js", () => ({
  getApiBaseUrl: () => "https://api.example.com",
}));

import {
  createMemoizedTokenGetter,
  isTRPCClientError,
  shouldRetryRateLimit,
} from "../trpc-provider.js";

describe("createMemoizedTokenGetter", () => {
  it("deduplicates concurrent calls into a single getToken invocation", async () => {
    const getToken = vi.fn().mockResolvedValue("token-abc");
    const getter = createMemoizedTokenGetter(getToken);

    // Fire 3 concurrent calls
    const [r1, r2, r3] = await Promise.all([getter(), getter(), getter()]);

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(r1).toBe("token-abc");
    expect(r2).toBe("token-abc");
    expect(r3).toBe("token-abc");
  });

  it("allows a fresh call after the previous one resolves", async () => {
    let callCount = 0;
    const getToken = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(`token-${String(callCount)}`);
    });
    const getter = createMemoizedTokenGetter(getToken);

    const first = await getter();
    expect(first).toBe("token-1");

    // After resolution, next call triggers a new getToken
    const second = await getter();
    expect(second).toBe("token-2");
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("clears pending on rejection so next call retries", async () => {
    const getToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce("token-ok");
    const getter = createMemoizedTokenGetter(getToken);

    await expect(getter()).rejects.toThrow("network error");

    // After rejection, pending is cleared — next call should succeed
    const result = await getter();
    expect(result).toBe("token-ok");
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("propagates rejection to all concurrent callers", async () => {
    const getToken = vi.fn().mockRejectedValue(new Error("fail"));
    const getter = createMemoizedTokenGetter(getToken);

    const results = await Promise.allSettled([getter(), getter(), getter()]);

    expect(getToken).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.status).toBe("rejected");
    }
  });
});

describe("isTRPCClientError", () => {
  it("returns true for TRPCClientError instance", () => {
    const error = new TRPCClientError("test error");
    expect(isTRPCClientError(error)).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isTRPCClientError(new Error("plain"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isTRPCClientError("string")).toBe(false);
    expect(isTRPCClientError(null)).toBe(false);
    expect(isTRPCClientError(undefined)).toBe(false);
    expect(isTRPCClientError(42)).toBe(false);
  });
});

describe("shouldRetryRateLimit", () => {
  it("returns true for 429 httpStatus under 3 attempts", () => {
    const opts = { error: { data: { httpStatus: 429, code: "OTHER" } }, attempts: 1 };
    expect(shouldRetryRateLimit(opts as never)).toBe(true);
  });

  it("returns true for TOO_MANY_REQUESTS code under 3 attempts", () => {
    const opts = { error: { data: { httpStatus: 400, code: "TOO_MANY_REQUESTS" } }, attempts: 2 };
    expect(shouldRetryRateLimit(opts as never)).toBe(true);
  });

  it("returns false for non-429 errors", () => {
    const opts = { error: { data: { httpStatus: 500, code: "INTERNAL_ERROR" } }, attempts: 1 };
    expect(shouldRetryRateLimit(opts as never)).toBe(false);
  });

  it("returns false after 3 attempts", () => {
    const opts = { error: { data: { httpStatus: 429, code: "TOO_MANY_REQUESTS" } }, attempts: 3 };
    expect(shouldRetryRateLimit(opts as never)).toBe(false);
  });

  it("returns false when error data is missing", () => {
    const opts = { error: {}, attempts: 1 };
    expect(shouldRetryRateLimit(opts as never)).toBe(false);
  });
});
