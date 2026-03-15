import { describe, expect, it } from "vitest";

import { calculateBackoff } from "../policies/backoff.js";

import type { RetryPolicy } from "@pluralscape/types";

describe("calculateBackoff", () => {
  const exponentialPolicy: RetryPolicy = {
    maxRetries: 3,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
    strategy: "exponential",
  };

  const linearPolicy: RetryPolicy = {
    maxRetries: 3,
    backoffMs: 5_000,
    backoffMultiplier: 1,
    maxBackoffMs: 30_000,
    strategy: "linear",
  };

  describe("exponential strategy", () => {
    it("returns base backoff on first attempt", () => {
      expect(calculateBackoff(exponentialPolicy, 1)).toBe(1_000);
    });

    it("doubles on second attempt", () => {
      expect(calculateBackoff(exponentialPolicy, 2)).toBe(2_000);
    });

    it("quadruples on third attempt", () => {
      expect(calculateBackoff(exponentialPolicy, 3)).toBe(4_000);
    });

    it("caps at maxBackoffMs", () => {
      const policy: RetryPolicy = {
        maxRetries: 10,
        backoffMs: 1_000,
        backoffMultiplier: 10,
        maxBackoffMs: 5_000,
      };
      // 1000 * 10^4 = 10_000_000, but capped at 5_000
      expect(calculateBackoff(policy, 5)).toBe(5_000);
    });

    it("defaults to exponential when strategy is omitted", () => {
      const policyNoStrategy: RetryPolicy = {
        maxRetries: 3,
        backoffMs: 1_000,
        backoffMultiplier: 2,
        maxBackoffMs: 30_000,
      };
      expect(calculateBackoff(policyNoStrategy, 2)).toBe(2_000);
    });
  });

  describe("linear strategy", () => {
    it("returns base * 1 on first attempt", () => {
      expect(calculateBackoff(linearPolicy, 1)).toBe(5_000);
    });

    it("returns base * 2 on second attempt", () => {
      expect(calculateBackoff(linearPolicy, 2)).toBe(10_000);
    });

    it("returns base * 3 on third attempt", () => {
      expect(calculateBackoff(linearPolicy, 3)).toBe(15_000);
    });

    it("caps at maxBackoffMs", () => {
      // 5000 * 7 = 35_000, capped at 30_000
      expect(calculateBackoff(linearPolicy, 7)).toBe(30_000);
    });
  });

  describe("jitter", () => {
    it("applies jitter within expected range", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoffMs: 1_000,
        backoffMultiplier: 2,
        maxBackoffMs: 30_000,
        jitterFraction: 0.2,
      };
      const base = 1_000; // attempt 1 base delay
      for (let i = 0; i < 100; i++) {
        const result = calculateBackoff(policy, 1);
        expect(result).toBeGreaterThanOrEqual(Math.round(base * 0.8));
        expect(result).toBeLessThanOrEqual(Math.round(base * 1.2));
      }
    });

    it("does not apply jitter when fraction is 0", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoffMs: 1_000,
        backoffMultiplier: 2,
        maxBackoffMs: 30_000,
        jitterFraction: 0,
      };
      expect(calculateBackoff(policy, 1)).toBe(1_000);
      expect(calculateBackoff(policy, 2)).toBe(2_000);
    });

    it("does not apply jitter when fraction is omitted", () => {
      expect(calculateBackoff(exponentialPolicy, 1)).toBe(1_000);
    });

    it("caps jittered value at maxBackoffMs", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoffMs: 25_000,
        backoffMultiplier: 2,
        maxBackoffMs: 30_000,
        jitterFraction: 0.5,
      };
      for (let i = 0; i < 50; i++) {
        expect(calculateBackoff(policy, 1)).toBeLessThanOrEqual(30_000);
      }
    });

    it("produces variation across calls (not all identical)", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoffMs: 1_000,
        backoffMultiplier: 2,
        maxBackoffMs: 30_000,
        jitterFraction: 0.2,
      };
      const values = new Set<number>();
      for (let i = 0; i < 50; i++) {
        values.add(calculateBackoff(policy, 1));
      }
      expect(values.size).toBeGreaterThan(1);
    });
  });

  describe("edge cases", () => {
    it("handles attempt 0 gracefully for exponential", () => {
      // attempt 0: 1000 * 2^(-1) = 500
      expect(calculateBackoff(exponentialPolicy, 0)).toBe(500);
    });

    it("handles attempt 0 gracefully for linear", () => {
      // attempt 0: 5000 * 0 = 0
      expect(calculateBackoff(linearPolicy, 0)).toBe(0);
    });

    it("returns maxBackoffMs when base already exceeds max", () => {
      const policy: RetryPolicy = {
        maxRetries: 1,
        backoffMs: 100_000,
        backoffMultiplier: 2,
        maxBackoffMs: 5_000,
        strategy: "exponential",
      };
      expect(calculateBackoff(policy, 1)).toBe(5_000);
    });
  });
});
