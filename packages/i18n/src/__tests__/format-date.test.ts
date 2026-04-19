import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatTime } from "../format-date.js";

import type { Locale } from "@pluralscape/types";

const EN: Locale = "en";
const DE: Locale = "de";
const AR: Locale = "ar";

// Fixed date: 2026-03-15 14:30:00 UTC
const DATE = new Date("2026-03-15T14:30:00Z");

describe("formatDate", () => {
  describe("iso preference", () => {
    it("formats as YYYY-MM-DD", () => {
      expect(formatDate(DATE, EN, "iso")).toBe("2026-03-15");
    });

    it("pads single-digit months and days", () => {
      const jan = new Date("2026-01-05T00:00:00Z");
      expect(formatDate(jan, EN, "iso")).toBe("2026-01-05");
    });
  });

  describe("us preference", () => {
    it("formats as MM/DD/YYYY", () => {
      expect(formatDate(DATE, EN, "us")).toBe("03/15/2026");
    });
  });

  describe("eu preference", () => {
    it("formats as DD/MM/YYYY", () => {
      expect(formatDate(DATE, EN, "eu")).toBe("15/03/2026");
    });
  });

  describe("relative preference", () => {
    it("uses relative time for recent dates", () => {
      const now = new Date("2026-03-15T17:30:00Z");
      const result = formatDate(DATE, EN, "relative", now);
      expect(result).toBe("3 hours ago");
    });

    it("falls back to locale format for dates older than 7 days", () => {
      const now = new Date("2026-03-25T14:30:00Z");
      const result = formatDate(DATE, EN, "relative", now);
      // Should not be relative — should be a full date string
      expect(result).not.toContain("ago");
    });
  });

  describe("locale-aware formatting", () => {
    it("formats in German", () => {
      const result = formatDate(DATE, DE, "relative", DATE);
      // "relative" with 0 delta should give "now" / "jetzt"
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("formats in Arabic", () => {
      const result = formatDate(DATE, AR, "iso");
      expect(result).toBe("2026-03-15");
    });
  });
});

describe("formatTime", () => {
  it("formats time in English locale", () => {
    const result = formatTime(DATE, EN);
    // Node/ICU may format as "2:30 PM" (en-US default)
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats time in German locale", () => {
    const result = formatTime(DATE, DE);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats time in Arabic locale", () => {
    const result = formatTime(DATE, AR);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatDateTime", () => {
  it("combines date and time", () => {
    const result = formatDateTime(DATE, EN, "iso");
    expect(result).toContain("2026-03-15");
    expect(result).toContain(",");
  });

  it("uses the specified date preference", () => {
    const result = formatDateTime(DATE, EN, "us");
    expect(result).toContain("03/15/2026");
  });

  it("uses relative text with time for recent dates", () => {
    const now = new Date(DATE.getTime() + 3_600_000); // 1 hour later
    const result = formatDateTime(DATE, EN, "relative", now);
    expect(result).toContain(",");
  });

  it("uses Intl full format for old dates with relative preference", () => {
    const now = new Date(DATE.getTime() + 30 * 86_400_000); // 30 days later
    const result = formatDateTime(DATE, EN, "relative", now);
    expect(result).toContain("2026");
    expect(result).toContain("March");
  });
});
