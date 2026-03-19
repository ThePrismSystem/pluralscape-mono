import { describe, expect, it } from "vitest";

import { SlidingWindowCounter } from "../../ws/sliding-window-counter.js";

describe("SlidingWindowCounter", () => {
  it("allows requests within the limit", () => {
    const counter = new SlidingWindowCounter();
    const now = 1_000_000;
    const windowMs = 10_000;
    const limit = 5;

    for (let i = 0; i < 5; i++) {
      expect(counter.check(now, windowMs, limit)).toBe(true);
    }
  });

  it("rejects requests over the limit", () => {
    const counter = new SlidingWindowCounter();
    const now = 1_000_000;
    const windowMs = 10_000;
    const limit = 3;

    expect(counter.check(now, windowMs, limit)).toBe(true);
    expect(counter.check(now, windowMs, limit)).toBe(true);
    expect(counter.check(now, windowMs, limit)).toBe(true);
    // 4th request should be rejected
    expect(counter.check(now, windowMs, limit)).toBe(false);
  });

  it("resets after double window expiry", () => {
    const counter = new SlidingWindowCounter();
    const windowMs = 10_000;
    const limit = 3;

    // Fill window at time 1000
    counter.check(1000, windowMs, limit);
    counter.check(1000, windowMs, limit);
    counter.check(1000, windowMs, limit);

    // After 2 full windows, should allow again
    expect(counter.check(21_000, windowMs, limit)).toBe(true);
  });

  it("rotates window and weights previous count", () => {
    const counter = new SlidingWindowCounter();
    const windowMs = 10_000;
    const limit = 10;

    // Fill window with 8 requests
    for (let i = 0; i < 8; i++) {
      counter.check(1000, windowMs, limit);
    }

    // Move just past window boundary — previous count of 8 is weighted
    // At 11001 (1001ms into new window), weight = max(0, 1 - 1001/10000) ≈ 0.8999
    // effective = 8 * 0.8999 + 1 ≈ 8.2 (under 10)
    expect(counter.check(11_001, windowMs, limit)).toBe(true);
  });

  it("preserves window offset on rotation instead of setting to now", () => {
    const counter = new SlidingWindowCounter();
    const windowMs = 10_000;

    counter.check(1000, windowMs, 100);
    // windowStart is initially 0; first check doesn't rotate because 1000 < 10000
    // Move past 1 window from windowStart=0
    counter.check(11_500, windowMs, 100);

    // windowStart should be 0 + 10000 = 10000, not 11500
    expect(counter.snapshot().windowStart).toBe(10_000);
  });

  it("handles multiple window rotations in large time gap", () => {
    const counter = new SlidingWindowCounter();
    const windowMs = 10_000;

    counter.check(1000, windowMs, 100);
    // Jump ahead 3+ windows
    counter.check(35_000, windowMs, 100);

    // Should have fully reset
    expect(counter.snapshot().count).toBe(1);
    expect(counter.snapshot().previousCount).toBe(0);
  });
});
