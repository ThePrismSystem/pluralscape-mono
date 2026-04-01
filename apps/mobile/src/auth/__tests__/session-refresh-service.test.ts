import { describe, expect, it } from "vitest";

import { getSessionTimeouts } from "../session-refresh-service.js";

const DAYS_MS = 24 * 60 * 60 * 1_000;

describe("getSessionTimeouts — mobile", () => {
  const timeouts = getSessionTimeouts("mobile");

  it("idle timeout is 30 days", () => {
    expect(timeouts.idleTimeoutMs).toBe(30 * DAYS_MS);
  });

  it("absolute TTL is 90 days", () => {
    expect(timeouts.absoluteTtlMs).toBe(90 * DAYS_MS);
  });

  it("next refresh delay is 80% of idle timeout", () => {
    expect(timeouts.nextRefreshDelayMs).toBe(Math.floor(30 * DAYS_MS * 0.8));
  });

  it("next refresh delay is less than idle timeout", () => {
    expect(timeouts.nextRefreshDelayMs).toBeLessThan(timeouts.idleTimeoutMs);
  });
});

describe("getSessionTimeouts — web", () => {
  const timeouts = getSessionTimeouts("web");

  it("idle timeout is 7 days", () => {
    expect(timeouts.idleTimeoutMs).toBe(7 * DAYS_MS);
  });

  it("absolute TTL is 30 days", () => {
    expect(timeouts.absoluteTtlMs).toBe(30 * DAYS_MS);
  });

  it("next refresh delay is 80% of idle timeout", () => {
    expect(timeouts.nextRefreshDelayMs).toBe(Math.floor(7 * DAYS_MS * 0.8));
  });

  it("next refresh delay is less than idle timeout", () => {
    expect(timeouts.nextRefreshDelayMs).toBeLessThan(timeouts.idleTimeoutMs);
  });
});
