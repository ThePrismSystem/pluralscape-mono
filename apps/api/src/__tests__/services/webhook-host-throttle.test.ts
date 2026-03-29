import { afterEach, describe, expect, it } from "vitest";

import { WEBHOOK_PER_HOST_MAX_CONCURRENT } from "../../service.constants.js";
import { acquireHostSlot, releaseHostSlot } from "../../services/webhook-delivery-worker.js";

describe("per-hostname concurrency throttle", () => {
  afterEach(() => {
    // Clean up any acquired slots
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT + 1; i++) {
      releaseHostSlot("example.com");
      releaseHostSlot("other.com");
    }
  });

  it("acquires a slot for a new hostname", () => {
    expect(acquireHostSlot("example.com")).toBe(true);
  });

  it("acquires up to the max concurrent slots", () => {
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT; i++) {
      expect(acquireHostSlot("example.com")).toBe(true);
    }
  });

  it("rejects when at max capacity", () => {
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT; i++) {
      acquireHostSlot("example.com");
    }
    expect(acquireHostSlot("example.com")).toBe(false);
  });

  it("allows different hostnames independently", () => {
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT; i++) {
      acquireHostSlot("example.com");
    }
    expect(acquireHostSlot("other.com")).toBe(true);
  });

  it("releases a slot allowing new acquisition", () => {
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT; i++) {
      acquireHostSlot("example.com");
    }
    expect(acquireHostSlot("example.com")).toBe(false);

    releaseHostSlot("example.com");
    expect(acquireHostSlot("example.com")).toBe(true);
  });

  it("cleans up map entry when last slot is released", () => {
    acquireHostSlot("example.com");
    releaseHostSlot("example.com");
    // After release, should be able to acquire max again
    for (let i = 0; i < WEBHOOK_PER_HOST_MAX_CONCURRENT; i++) {
      expect(acquireHostSlot("example.com")).toBe(true);
    }
  });

  it("handles release of non-acquired hostname gracefully", () => {
    // Should not throw
    releaseHostSlot("never-acquired.com");
  });
});
