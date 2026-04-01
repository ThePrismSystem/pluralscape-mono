import { describe, expect, it } from "vitest";

import { SessionRefreshService } from "../session-refresh-service.js";

const DAYS_MS = 24 * 60 * 60 * 1000;

describe("SessionRefreshService — mobile", () => {
  const service = new SessionRefreshService({ platform: "mobile" });

  it("idle timeout is 30 days", () => {
    expect(service.idleTimeoutMs).toBe(30 * DAYS_MS);
  });

  it("absolute TTL is 90 days", () => {
    expect(service.absoluteTtlMs).toBe(90 * DAYS_MS);
  });

  it("next refresh delay is less than 30 days", () => {
    expect(service.nextRefreshDelayMs()).toBeLessThan(30 * DAYS_MS);
  });
});

describe("SessionRefreshService — web", () => {
  const service = new SessionRefreshService({ platform: "web" });

  it("idle timeout is 7 days", () => {
    expect(service.idleTimeoutMs).toBe(7 * DAYS_MS);
  });

  it("absolute TTL is 30 days", () => {
    expect(service.absoluteTtlMs).toBe(30 * DAYS_MS);
  });

  it("next refresh delay is less than 7 days", () => {
    expect(service.nextRefreshDelayMs()).toBeLessThan(7 * DAYS_MS);
  });
});
