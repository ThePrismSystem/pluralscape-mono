import { describe, expect, it } from "vitest";

import { computeNextCheckInAt } from "../../lib/timer-scheduling.js";

const MS_PER_MINUTE = 60_000;

function wakingConfig(overrides?: {
  intervalMinutes?: number;
  wakingHoursOnly?: boolean | null;
  wakingStart?: string | null;
  wakingEnd?: string | null;
}) {
  return {
    intervalMinutes: overrides?.intervalMinutes ?? 60,
    wakingHoursOnly: overrides?.wakingHoursOnly ?? true,
    wakingStart: overrides?.wakingStart ?? "08:00",
    wakingEnd: overrides?.wakingEnd ?? "22:00",
  };
}

describe("computeNextCheckInAt", () => {
  describe("without waking hours", () => {
    it("returns nowMs + interval when wakingHoursOnly is false", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      const result = computeNextCheckInAt(
        { intervalMinutes: 30, wakingHoursOnly: false, wakingStart: null, wakingEnd: null },
        nowMs,
      );
      expect(result).toBe(nowMs + 30 * MS_PER_MINUTE);
    });

    it("returns nowMs + interval when wakingHoursOnly is null", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      const result = computeNextCheckInAt(
        { intervalMinutes: 60, wakingHoursOnly: null, wakingStart: null, wakingEnd: null },
        nowMs,
      );
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });

    it("returns nowMs + interval when wakingStart is missing", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      const result = computeNextCheckInAt(
        { intervalMinutes: 60, wakingHoursOnly: true, wakingStart: null, wakingEnd: "22:00" },
        nowMs,
      );
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });

    it("returns nowMs + interval when wakingEnd is missing", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      const result = computeNextCheckInAt(
        { intervalMinutes: 60, wakingHoursOnly: true, wakingStart: "08:00", wakingEnd: null },
        nowMs,
      );
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });
  });

  describe("daytime waking hours (08:00-22:00)", () => {
    it("does not clamp when next time is within waking window", () => {
      const nowMs = Date.UTC(2026, 3, 14, 10, 0);
      const result = computeNextCheckInAt(wakingConfig({ intervalMinutes: 60 }), nowMs);
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });

    it("clamps to next waking start when next time falls after end", () => {
      const nowMs = Date.UTC(2026, 3, 14, 21, 30);
      const result = computeNextCheckInAt(wakingConfig({ intervalMinutes: 60 }), nowMs);
      const expected = Date.UTC(2026, 3, 15, 8, 0);
      expect(result).toBe(expected);
    });

    it("clamps to next waking start when next time falls before start", () => {
      const nowMs = Date.UTC(2026, 3, 14, 6, 0);
      const result = computeNextCheckInAt(wakingConfig({ intervalMinutes: 60 }), nowMs);
      const expected = Date.UTC(2026, 3, 14, 8, 0);
      expect(result).toBe(expected);
    });
  });

  describe("overnight waking hours (22:00-06:00)", () => {
    const overnightConfig = () => wakingConfig({ wakingStart: "22:00", wakingEnd: "06:00" });

    it("does not clamp when next time is after start (e.g. 23:00)", () => {
      const nowMs = Date.UTC(2026, 3, 14, 22, 30);
      const result = computeNextCheckInAt(overnightConfig(), nowMs);
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });

    it("does not clamp when next time is before end (e.g. 03:00)", () => {
      const nowMs = Date.UTC(2026, 3, 15, 2, 0);
      const result = computeNextCheckInAt(overnightConfig(), nowMs);
      expect(result).toBe(nowMs + 60 * MS_PER_MINUTE);
    });

    it("clamps to 22:00 when next time is outside overnight range (e.g. 10:00)", () => {
      const nowMs = Date.UTC(2026, 3, 14, 9, 0);
      const result = computeNextCheckInAt(overnightConfig(), nowMs);
      const expected = Date.UTC(2026, 3, 14, 22, 0);
      expect(result).toBe(expected);
    });
  });

  describe("edge cases", () => {
    it("handles zero-minute interval", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      const result = computeNextCheckInAt(
        { intervalMinutes: 0, wakingHoursOnly: false, wakingStart: null, wakingEnd: null },
        nowMs,
      );
      expect(result).toBe(nowMs);
    });

    it("throws on malformed wakingStart", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      expect(() =>
        computeNextCheckInAt(
          { intervalMinutes: 60, wakingHoursOnly: true, wakingStart: "bad", wakingEnd: "22:00" },
          nowMs,
        ),
      ).toThrow("Invalid waking time format");
    });

    it("throws on non-numeric wakingEnd", () => {
      const nowMs = Date.UTC(2026, 3, 14, 12, 0);
      expect(() =>
        computeNextCheckInAt(
          { intervalMinutes: 60, wakingHoursOnly: true, wakingStart: "08:00", wakingEnd: "ab:cd" },
          nowMs,
        ),
      ).toThrow("Invalid waking time");
    });
  });
});
