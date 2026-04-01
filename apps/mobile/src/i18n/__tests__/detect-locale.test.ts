import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn(),
}));

import { detectLocale } from "../detect-locale.js";

const mockGetLocales = vi.mocked(getLocales);

describe("detectLocale", () => {
  it("returns the first supported locale that matches a full language tag", () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: "en-US",
        languageCode: "en",
        regionCode: "US",
        currencyCode: "USD",
        currencySymbol: "$",
        decimalSeparator: ".",
        digitGroupingSeparator: ",",
        measurementSystem: "us",
        textDirection: "ltr",
        temperatureUnit: "fahrenheit",
      },
    ]);
    expect(detectLocale(["en-US", "fr"])).toBe("en-US");
  });

  it("returns a match on languageCode when full tag is not supported", () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: "en-AU",
        languageCode: "en",
        regionCode: "AU",
        currencyCode: "AUD",
        currencySymbol: "A$",
        decimalSeparator: ".",
        digitGroupingSeparator: ",",
        measurementSystem: "metric",
        textDirection: "ltr",
        temperatureUnit: "celsius",
      },
    ]);
    expect(detectLocale(["en", "fr"])).toBe("en");
  });

  it("falls back to DEFAULT_LOCALE when no device locale is supported", () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: "ja-JP",
        languageCode: "ja",
        regionCode: "JP",
        currencyCode: "JPY",
        currencySymbol: "¥",
        decimalSeparator: ".",
        digitGroupingSeparator: ",",
        measurementSystem: "metric",
        textDirection: "ltr",
        temperatureUnit: "celsius",
      },
    ]);
    expect(detectLocale(["en", "fr"])).toBe(DEFAULT_LOCALE);
  });

  it("falls back to DEFAULT_LOCALE when device locale list is empty", () => {
    mockGetLocales.mockReturnValue([]);
    expect(detectLocale(SUPPORTED_LOCALES)).toBe(DEFAULT_LOCALE);
  });

  it("returns first matching locale when multiple device locales are listed", () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: "de-DE",
        languageCode: "de",
        regionCode: "DE",
        currencyCode: "EUR",
        currencySymbol: "€",
        decimalSeparator: ",",
        digitGroupingSeparator: ".",
        measurementSystem: "metric",
        textDirection: "ltr",
        temperatureUnit: "celsius",
      },
      {
        languageTag: "fr-FR",
        languageCode: "fr",
        regionCode: "FR",
        currencyCode: "EUR",
        currencySymbol: "€",
        decimalSeparator: ",",
        digitGroupingSeparator: ".",
        measurementSystem: "metric",
        textDirection: "ltr",
        temperatureUnit: "celsius",
      },
    ]);
    expect(detectLocale(["fr", "de"])).toBe("de");
  });
});
