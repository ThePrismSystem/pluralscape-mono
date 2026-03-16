import { describe, expect, it } from "vitest";

import { formatCompactNumber, formatNumber, formatPercentage } from "../format-number.js";

import type { Locale } from "@pluralscape/types";

const EN = "en" as Locale;
const DE = "de" as Locale;
const AR = "ar" as Locale;

describe("formatNumber", () => {
  describe("locale preference", () => {
    it("formats with English thousand separators", () => {
      expect(formatNumber(1234, EN, "locale")).toBe("1,234");
    });

    it("formats with German thousand separators", () => {
      expect(formatNumber(1234, DE, "locale")).toBe("1.234");
    });

    it("formats with Arabic locale", () => {
      const result = formatNumber(1234, AR, "locale");
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("formats large numbers", () => {
      expect(formatNumber(1_000_000, EN, "locale")).toBe("1,000,000");
    });

    it("formats zero", () => {
      expect(formatNumber(0, EN, "locale")).toBe("0");
    });

    it("formats negative numbers", () => {
      const result = formatNumber(-1234, EN, "locale");
      expect(result).toContain("1,234");
    });
  });

  describe("system preference", () => {
    it("uses system locale formatting", () => {
      const result = formatNumber(1234, EN, "system");
      expect(result).toBeDefined();
    });
  });
});

describe("formatCompactNumber", () => {
  it("formats thousands in English", () => {
    const result = formatCompactNumber(1200, EN);
    expect(result).toMatch(/1\.?2K/);
  });

  it("formats millions in English", () => {
    const result = formatCompactNumber(3_400_000, EN);
    expect(result).toMatch(/3\.?4M/);
  });

  it("formats small numbers without abbreviation", () => {
    expect(formatCompactNumber(42, EN)).toBe("42");
  });

  it("formats in German", () => {
    const result = formatCompactNumber(1200, DE);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatPercentage", () => {
  it("formats as percentage in English", () => {
    expect(formatPercentage(0.75, EN)).toBe("75%");
  });

  it("formats fractional percentages", () => {
    const result = formatPercentage(0.333, EN);
    expect(result).toBe("33.3%");
  });

  it("formats 100%", () => {
    expect(formatPercentage(1, EN)).toBe("100%");
  });

  it("formats zero", () => {
    expect(formatPercentage(0, EN)).toBe("0%");
  });

  it("formats in German", () => {
    const result = formatPercentage(0.75, DE);
    // German uses different space/symbol conventions
    expect(result).toContain("75");
    expect(result).toContain("%");
  });
});
