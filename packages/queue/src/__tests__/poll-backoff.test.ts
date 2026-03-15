import { describe, expect, it } from "vitest";

import { MAX_POLL_BACKOFF_MS, POLL_BACKOFF_BASE_MS, pollBackoffMs } from "../queue.constants.js";

describe("pollBackoffMs", () => {
  it("returns 0 for 0 failures", () => {
    expect(pollBackoffMs(0)).toBe(0);
  });

  it("returns 0 for negative failures", () => {
    expect(pollBackoffMs(-1)).toBe(0);
  });

  it("returns base delay for 1 failure", () => {
    expect(pollBackoffMs(1)).toBe(POLL_BACKOFF_BASE_MS); // 100
  });

  it("doubles for 2 failures", () => {
    expect(pollBackoffMs(2)).toBe(POLL_BACKOFF_BASE_MS * 2); // 200
  });

  it("returns 1600 for 5 failures", () => {
    expect(pollBackoffMs(5)).toBe(POLL_BACKOFF_BASE_MS * 16); // 1600
  });

  it("caps at MAX_POLL_BACKOFF_MS for high failure counts", () => {
    expect(pollBackoffMs(10)).toBe(MAX_POLL_BACKOFF_MS);
    expect(pollBackoffMs(20)).toBe(MAX_POLL_BACKOFF_MS);
  });
});
