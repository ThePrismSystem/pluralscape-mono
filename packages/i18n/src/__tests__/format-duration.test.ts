import { describe, expect, it } from "vitest";

import { formatDuration, formatFrontingDuration } from "../format-duration.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatDuration", () => {
  it("formats zero duration", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(45 * SECOND)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(2 * MINUTE + 30 * SECOND)).toBe("2m 30s");
  });

  it("formats hours only", () => {
    expect(formatDuration(HOUR)).toBe("1h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(2 * HOUR + 15 * MINUTE)).toBe("2h 15m");
  });

  it("formats days", () => {
    expect(formatDuration(DAY)).toBe("1d");
  });

  it("formats days and hours", () => {
    expect(formatDuration(DAY + 3 * HOUR)).toBe("1d 3h");
  });

  it("omits seconds when days are present", () => {
    const result = formatDuration(DAY + 30 * SECOND);
    expect(result).not.toContain("s");
  });

  describe("narrow style", () => {
    it("removes spaces between parts", () => {
      expect(formatDuration(2 * HOUR + 15 * MINUTE, "narrow")).toBe("2h15m");
    });

    it("formats zero duration", () => {
      expect(formatDuration(0, "narrow")).toBe("0s");
    });
  });
});

describe("formatFrontingDuration", () => {
  const START = 1710500000000; // fixed timestamp

  it("formats a completed fronting session", () => {
    const end = START + 2 * HOUR + 15 * MINUTE;
    expect(formatFrontingDuration(START, end)).toBe("2h 15m");
  });

  it("formats an ongoing fronting session with explicit now", () => {
    const now = START + HOUR + 30 * MINUTE;
    expect(formatFrontingDuration(START, null, now)).toBe("1h 30m");
  });

  it("returns zero duration when start equals end", () => {
    expect(formatFrontingDuration(START, START)).toBe("0s");
  });

  it("handles end before start gracefully (clamps to zero)", () => {
    expect(formatFrontingDuration(START, START - 1000)).toBe("0s");
  });
});
