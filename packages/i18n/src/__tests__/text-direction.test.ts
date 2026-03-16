import { describe, expect, it } from "vitest";

import { getTextDirection, isRtl } from "../text-direction.js";

import type { Locale } from "@pluralscape/types";

describe("isRtl", () => {
  it.each([
    ["ar" as Locale, true],
    ["he" as Locale, true],
    ["fa" as Locale, true],
    ["ur" as Locale, true],
    ["ar-SA" as Locale, true],
    ["he-IL" as Locale, true],
  ])("returns true for RTL locale %s", (locale, expected) => {
    expect(isRtl(locale)).toBe(expected);
  });

  it.each([
    ["en" as Locale, false],
    ["en-US" as Locale, false],
    ["de" as Locale, false],
    ["ja" as Locale, false],
    ["zh-CN" as Locale, false],
    ["fr" as Locale, false],
  ])("returns false for LTR locale %s", (locale, expected) => {
    expect(isRtl(locale)).toBe(expected);
  });
});

describe("getTextDirection", () => {
  it("returns rtl for Arabic", () => {
    expect(getTextDirection("ar" as Locale)).toBe("rtl");
  });

  it("returns ltr for English", () => {
    expect(getTextDirection("en" as Locale)).toBe("ltr");
  });

  it("returns rtl for Hebrew with region", () => {
    expect(getTextDirection("he-IL" as Locale)).toBe("rtl");
  });

  it("returns ltr for Japanese", () => {
    expect(getTextDirection("ja" as Locale)).toBe("ltr");
  });
});
