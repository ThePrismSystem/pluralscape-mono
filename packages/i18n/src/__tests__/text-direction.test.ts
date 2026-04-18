import { describe, expect, it } from "vitest";

import { getTextDirection, isRtl } from "../text-direction.js";

import type { Locale } from "@pluralscape/types";

describe("isRtl", () => {
  it.each([
    ["ar", true],
    ["he", true],
    ["fa", true],
    ["ur", true],
    ["ar-SA", true],
    ["he-IL", true],
  ])("returns true for RTL locale %s", (locale, expected) => {
    expect(isRtl(locale)).toBe(expected);
  });

  it.each([
    ["en", false],
    ["en-US", false],
    ["de", false],
    ["ja", false],
    ["zh-CN", false],
    ["fr", false],
  ])("returns false for LTR locale %s", (locale, expected) => {
    expect(isRtl(locale)).toBe(expected);
  });
});

describe("getTextDirection", () => {
  it("returns rtl for Arabic", () => {
    const ar: Locale = "ar";
    expect(getTextDirection(ar)).toBe("rtl");
  });

  it("returns ltr for English", () => {
    const en: Locale = "en";
    expect(getTextDirection(en)).toBe("ltr");
  });

  it("returns ltr for Japanese", () => {
    const ja: Locale = "ja";
    expect(getTextDirection(ja)).toBe("ltr");
  });

  it("returns ltr for simplified Chinese", () => {
    const zh: Locale = "zh-Hans";
    expect(getTextDirection(zh)).toBe("ltr");
  });
});
