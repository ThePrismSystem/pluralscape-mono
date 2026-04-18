import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "../format-relative-time.js";

import type { Locale } from "@pluralscape/types";

const EN: Locale = "en";
const DE: Locale = "de";
const AR: Locale = "ar";

// Fixed reference: 2026-03-15 12:00:00 UTC
const NOW = new Date("2026-03-15T12:00:00Z");

function pastDate(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  describe("English locale", () => {
    it("formats seconds ago", () => {
      const result = formatRelativeTime(pastDate(30 * SECOND), EN, NOW);
      expect(result).toMatch(/30 seconds ago/);
    });

    it("formats minutes ago", () => {
      const result = formatRelativeTime(pastDate(5 * MINUTE), EN, NOW);
      expect(result).toMatch(/5 minutes ago/);
    });

    it("formats hours ago", () => {
      const result = formatRelativeTime(pastDate(2 * HOUR), EN, NOW);
      expect(result).toMatch(/2 hours ago/);
    });

    it("formats yesterday", () => {
      const result = formatRelativeTime(pastDate(DAY), EN, NOW);
      expect(result).toMatch(/yesterday|1 day ago/);
    });

    it("formats days ago", () => {
      const result = formatRelativeTime(pastDate(3 * DAY), EN, NOW);
      expect(result).toMatch(/3 days ago/);
    });

    it("formats now for zero delta", () => {
      const result = formatRelativeTime(NOW, EN, NOW);
      expect(result).toBeDefined();
      // Should be "now" or "0 seconds ago"
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("German locale", () => {
    it("formats in German", () => {
      const result = formatRelativeTime(pastDate(5 * MINUTE), DE, NOW);
      expect(result).toBeDefined();
      // German: "vor 5 Minuten"
      expect(result).toContain("5");
    });
  });

  describe("Arabic locale", () => {
    it("formats in Arabic", () => {
      const result = formatRelativeTime(pastDate(2 * HOUR), AR, NOW);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("future dates", () => {
    it("formats future time", () => {
      const future = new Date(NOW.getTime() + 3 * HOUR);
      const result = formatRelativeTime(future, EN, NOW);
      expect(result).toMatch(/in 3 hours/);
    });
  });

  describe("default now", () => {
    it("uses current time when now is omitted", () => {
      const recent = new Date(Date.now() - 5 * MINUTE);
      const result = formatRelativeTime(recent, EN);
      expect(result).toMatch(/5 minutes ago/);
    });
  });
});
