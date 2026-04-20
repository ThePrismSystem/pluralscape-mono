import { describe, expect, it } from "vitest";

import {
  LocaleSchema,
  NamespaceSchema,
  assertSafeLocaleAndNamespace,
} from "../../../routes/i18n/schemas.js";

describe("LocaleSchema", () => {
  it.each([
    ["en", true],
    ["es", true],
    ["en-US", true],
    ["zh-Hant", true],
    ["en_US", false],
    ["", false],
    ["../..", false],
    ["..%2Fetc", false],
    ["en-US/..", false],
    ["a", false],
    ["abcd", false],
  ])("%s → valid=%s", (locale, isValid) => {
    expect(LocaleSchema.safeParse(locale).success).toBe(isValid);
  });
});

describe("NamespaceSchema", () => {
  it.each([
    ["common", true],
    ["mobile-onboarding", true],
    ["snake_case", true],
    ["CAPS-OK-123", true],
    ["../etc", false],
    ["with.dot", false],
    ["", false],
    ["space space", false],
    ["unicode\u00a0", false],
  ])("%s → valid=%s", (namespace, isValid) => {
    expect(NamespaceSchema.safeParse(namespace).success).toBe(isValid);
  });
});

describe("assertSafeLocaleAndNamespace", () => {
  it("returns without error for valid inputs", () => {
    expect(() => {
      assertSafeLocaleAndNamespace("en", "common");
    }).not.toThrow();
  });

  it("throws for invalid locale", () => {
    expect(() => {
      assertSafeLocaleAndNamespace("../..", "common");
    }).toThrow();
  });

  it("throws for invalid namespace", () => {
    expect(() => {
      assertSafeLocaleAndNamespace("en", "../etc");
    }).toThrow();
  });
});
