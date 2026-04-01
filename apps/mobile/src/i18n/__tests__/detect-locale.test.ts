import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn(),
}));

import { detectLocale } from "../detect-locale.js";

import type { Locale } from "@pluralscape/types";
import type { Locale as ExpoLocale } from "expo-localization";

function asLocales(...tags: string[]): Locale[] {
  return tags as Locale[];
}

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
  it("returns the first supported locale that matches a full language tag", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "en-US",
        languageCode: "en",
        regionCode: "US",
        measurementSystem: "us",
        textDirection: "ltr",
        temperatureUnit: "fahrenheit",
      }),
    ]);
    expect(detectLocale(asLocales("en-US", "fr"))).toBe("en-US");
  });

  it("returns a match on languageCode when full tag is not supported", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "en-AU",
        languageCode: "en",
        regionCode: "AU",
      }),
    ]);
    expect(detectLocale(asLocales("en", "fr"))).toBe("en");
  });

  it("falls back to DEFAULT_LOCALE when no device locale is supported", () => {
    mockGetLocales.mockReturnValue([
      makeLocale({
        languageTag: "ja-JP",
        languageCode: "ja",
        regionCode: "JP",
      }),
    ]);
    expect(detectLocale(asLocales("en", "fr"))).toBe(DEFAULT_LOCALE);
  });

  it("falls back to DEFAULT_LOCALE when no device locales match any supported locale", () => {
    // Uses a locale whose tag and languageCode are both absent from the supported list
    mockGetLocales.mockReturnValue([
      makeLocale({ languageTag: "zh-CN", languageCode: "zh", regionCode: "CN" }),
    ]);
    expect(detectLocale(SUPPORTED_LOCALES)).toBe(DEFAULT_LOCALE);
  });

  it("returns first matching locale when multiple device locales are listed", () => {
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
    expect(detectLocale(asLocales("fr", "de"))).toBe("de");
  });
});
