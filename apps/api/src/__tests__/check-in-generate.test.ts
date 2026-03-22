import { describe, expect, it } from "vitest";

import {
  computeIdempotencyKey,
  getCurrentMinutesUtc,
  isWithinWakingHours,
  parseTimeToMinutes,
} from "../jobs/check-in-generate.js";

describe("parseTimeToMinutes", () => {
  it("parses valid HH:MM string", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("12:00")).toBe(720);
  });

  it("returns null for invalid formats", () => {
    expect(parseTimeToMinutes("8:30")).toBeNull();
    expect(parseTimeToMinutes("invalid")).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });

  it("parses out-of-range hours as valid minutes (validation is done at schema level)", () => {
    // parseTimeToMinutes is a parser, not a validator
    // Schema-level HH:MM validation rejects out-of-range values
    expect(parseTimeToMinutes("25:00")).toBe(1500);
  });
});

describe("isWithinWakingHours", () => {
  it("returns true when within window", () => {
    // 10:00 is within 08:00-22:00
    expect(isWithinWakingHours(600, 480, 1320)).toBe(true);
  });

  it("returns false when before window", () => {
    // 06:00 is before 08:00-22:00
    expect(isWithinWakingHours(360, 480, 1320)).toBe(false);
  });

  it("returns false when after window", () => {
    // 23:00 is after 08:00-22:00
    expect(isWithinWakingHours(1380, 480, 1320)).toBe(false);
  });

  it("returns true at exact start", () => {
    expect(isWithinWakingHours(480, 480, 1320)).toBe(true);
  });

  it("returns false at exact end", () => {
    expect(isWithinWakingHours(1320, 480, 1320)).toBe(false);
  });
});

describe("getCurrentMinutesUtc", () => {
  it("returns minutes since midnight for a given timestamp", () => {
    // 2024-01-01T10:30:00Z = 630 minutes
    const timestamp = new Date("2024-01-01T10:30:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(630);
  });

  it("returns 0 for midnight", () => {
    const timestamp = new Date("2024-01-01T00:00:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(0);
  });

  it("returns 1439 for 23:59", () => {
    const timestamp = new Date("2024-01-01T23:59:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(1439);
  });
});

describe("computeIdempotencyKey", () => {
  it("produces consistent keys within the same interval window", () => {
    const configId = "tmr_test-config";
    const intervalMinutes = 30;

    // Two timestamps 10 minutes apart within the same 30-min window
    const t1 = 1_800_000; // 30 min * 60s * 1000ms = window 1
    const t2 = 1_800_000 + 600_000; // +10 min, still window 1

    const key1 = computeIdempotencyKey(configId, intervalMinutes, t1);
    const key2 = computeIdempotencyKey(configId, intervalMinutes, t2);

    expect(key1).toBe(key2);
  });

  it("produces different keys in different interval windows", () => {
    const configId = "tmr_test-config";
    const intervalMinutes = 30;

    // Window boundary: 30 min * 60s * 1000ms = 1_800_000
    const t1 = 1_800_000;
    const t2 = 1_800_000 * 2; // Next window

    const key1 = computeIdempotencyKey(configId, intervalMinutes, t1);
    const key2 = computeIdempotencyKey(configId, intervalMinutes, t2);

    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different timer configs", () => {
    const t = 1_800_000;
    const key1 = computeIdempotencyKey("tmr_a", 30, t);
    const key2 = computeIdempotencyKey("tmr_b", 30, t);

    expect(key1).not.toBe(key2);
  });
});
