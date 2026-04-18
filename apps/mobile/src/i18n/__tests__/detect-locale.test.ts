import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn(),
}));

import { detectLocale } from "../detect-locale.js";

import type { Locale } from "@pluralscape/types";
import type { Locale as ExpoLocale } from "expo-localization";

const mockGetLocales = vi.mocked(getLocales);

function makeLocale(overrides: Partial<ExpoLocale> & { languageTag: string }): ExpoLocale {
  return Object.assign<ExpoLocale, Partial<ExpoLocale>>(
    {
      languageTag: "",
      languageCode: null,
      languageScriptCode: null,
      regionCode: null,
      languageRegionCode: null,
      currencyCode: null,
      currencySymbol: null,
      languageCurrencyCode: null,
      languageCurrencySymbol: null,
      decimalSeparator: ".",
      digitGroupingSeparator: ",",
      measurementSystem: null,
      textDirection: "ltr",
      temperatureUnit: null,
    },
    overrides,
  );
}

describe("detectLocale", () => {
  it("returns the full language tag when it exactly matches a supported locale", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "es-419",
        languageCode: "es",
        regionCode: "419",
      }),
    ]);
    const supported: readonly Locale[] = ["es-419", "fr"];
    expect(detectLocale(supported)).toBe<Locale>("es-419");
  });

  it("returns a match on languageCode when the full tag is not supported", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "en-AU",
        languageCode: "en",
        regionCode: "AU",
      }),
    ]);
    const supported: readonly Locale[] = ["en", "fr"];
    expect(detectLocale(supported)).toBe<Locale>("en");
  });

  it("falls back to DEFAULT_LOCALE when no device locale is supported", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "ja-JP",
        languageCode: "ja",
        regionCode: "JP",
      }),
    ]);
    const supported: readonly Locale[] = ["en", "fr"];
    expect(detectLocale(supported)).toBe(DEFAULT_LOCALE);
  });

  it("falls back to DEFAULT_LOCALE when the device tag is not in SUPPORTED_LOCALES", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({ languageTag: "vi-VN", languageCode: "vi", regionCode: "VN" }),
    ]);
    expect(detectLocale(SUPPORTED_LOCALES)).toBe(DEFAULT_LOCALE);
  });

  it("returns the first matching locale when multiple device locales are listed", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "de-DE",
        languageCode: "de",
        regionCode: "DE",
      }),
      makeLocale({
        languageTag: "fr-FR",
        languageCode: "fr",
        regionCode: "FR",
      }),
    ]);
    const supported: readonly Locale[] = ["fr", "de"];
    expect(detectLocale(supported)).toBe<Locale>("de");
  });
});
