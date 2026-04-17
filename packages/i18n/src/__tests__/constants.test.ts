import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
} from "../i18n.constants.js";

describe("i18n constants", () => {
  it("has a valid default locale", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("includes the default locale in supported locales", () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("has a non-empty supported locales list", () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(0);
  });

  it("contains all 12 target locales (en + 10 non-English + es-419 regional)", () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      ["de", "en", "es", "es-419", "fr", "it", "ja", "ko", "nl", "pt-BR", "ru", "zh-Hans"].sort(),
    );
  });

  it("has a non-empty namespaces list", () => {
    expect(NAMESPACES.length).toBeGreaterThan(0);
  });

  it("includes common namespace", () => {
    expect(NAMESPACES).toContain("common");
  });

  it("uses common as the default namespace", () => {
    expect(DEFAULT_NAMESPACE).toBe("common");
  });

  it("has known RTL locales", () => {
    expect(RTL_LOCALES).toContain("ar");
    expect(RTL_LOCALES).toContain("he");
    expect(RTL_LOCALES).toContain("fa");
    expect(RTL_LOCALES).toContain("ur");
  });
});
