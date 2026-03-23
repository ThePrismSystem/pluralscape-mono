import { MS_PER_DAY } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { parseAnalyticsQuery } from "../../services/analytics-query.service.js";

// ── Fixtures ─────────────────────────────────────────────────────────

const FAKE_NOW = 1_700_000_000_000;

// ── Tests ────────────────────────────────────────────────────────────

describe("parseAnalyticsQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to last-30-days when no params are provided", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({});

    expect(result).toEqual({
      preset: "last-30-days",
      start: FAKE_NOW - 30 * MS_PER_DAY,
      end: FAKE_NOW,
    });
  });

  it("returns correct range for last-7-days preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({ preset: "last-7-days" });

    expect(result).toEqual({
      preset: "last-7-days",
      start: FAKE_NOW - 7 * MS_PER_DAY,
      end: FAKE_NOW,
    });
  });

  it("returns correct range for last-30-days preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({ preset: "last-30-days" });

    expect(result).toEqual({
      preset: "last-30-days",
      start: FAKE_NOW - 30 * MS_PER_DAY,
      end: FAKE_NOW,
    });
  });

  it("returns correct range for last-90-days preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({ preset: "last-90-days" });

    expect(result).toEqual({
      preset: "last-90-days",
      start: FAKE_NOW - 90 * MS_PER_DAY,
      end: FAKE_NOW,
    });
  });

  it("returns correct range for last-year preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({ preset: "last-year" });

    expect(result).toEqual({
      preset: "last-year",
      start: FAKE_NOW - 365 * MS_PER_DAY,
      end: FAKE_NOW,
    });
  });

  it("returns start=0 and end=now for all-time preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({ preset: "all-time" });

    expect(result).toEqual({
      preset: "all-time",
      start: 0,
      end: FAKE_NOW,
    });
  });

  it("returns custom range when preset is custom with valid dates", () => {
    vi.spyOn(Date, "now").mockReturnValue(FAKE_NOW);

    const result = parseAnalyticsQuery({
      preset: "custom",
      startDate: "1_000_000".replaceAll("_", ""),
      endDate: "2_000_000".replaceAll("_", ""),
    });

    expect(result).toEqual({
      preset: "custom",
      start: 1_000_000,
      end: 2_000_000,
    });
  });

  it("throws ApiHttpError VALIDATION_ERROR when custom preset is missing startDate and endDate", () => {
    expect(() => parseAnalyticsQuery({ preset: "custom" })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
    expect(() => parseAnalyticsQuery({ preset: "custom" })).toThrow(ApiHttpError);
  });

  it("throws ApiHttpError VALIDATION_ERROR when custom preset has startDate but no endDate", () => {
    expect(() => parseAnalyticsQuery({ preset: "custom", startDate: "1000000" })).toThrow(
      ApiHttpError,
    );
  });

  it("throws ApiHttpError VALIDATION_ERROR when custom preset has endDate but no startDate", () => {
    expect(() => parseAnalyticsQuery({ preset: "custom", endDate: "2000000" })).toThrow(
      ApiHttpError,
    );
  });

  it("throws ApiHttpError VALIDATION_ERROR for an invalid preset value", () => {
    expect(() => parseAnalyticsQuery({ preset: "last-2-weeks" })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
    expect(() => parseAnalyticsQuery({ preset: "last-2-weeks" })).toThrow(ApiHttpError);
  });

  it("throws ApiHttpError VALIDATION_ERROR when endDate is less than startDate", () => {
    expect(() =>
      parseAnalyticsQuery({
        preset: "custom",
        startDate: "5000000",
        endDate: "1000000",
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      parseAnalyticsQuery({
        preset: "custom",
        startDate: "5000000",
        endDate: "1000000",
      }),
    ).toThrow(ApiHttpError);
  });
});
