import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  DateFormatPreference,
  Locale,
  LocaleConfig,
  NumberFormatPreference,
  TextDirection,
  TranslationKey,
  TranslationMap,
} from "../i18n.js";

describe("Locale", () => {
  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to Locale
    assertType<Locale>("en-US");
  });

  it("extends string", () => {
    expectTypeOf<Locale>().toExtend<string>();
  });
});

describe("TranslationKey", () => {
  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to TranslationKey
    assertType<TranslationKey>("settings.theme.dark");
  });

  it("extends string", () => {
    expectTypeOf<TranslationKey>().toExtend<string>();
  });
});

describe("TranslationMap", () => {
  it("is a readonly record of string to string", () => {
    expectTypeOf<TranslationMap>().toEqualTypeOf<Readonly<Record<string, string>>>();
  });
});

describe("TextDirection", () => {
  it("accepts valid directions", () => {
    assertType<TextDirection>("ltr");
    assertType<TextDirection>("rtl");
  });

  it("rejects invalid directions", () => {
    // @ts-expect-error invalid direction
    assertType<TextDirection>("auto");
  });
});

describe("DateFormatPreference", () => {
  it("accepts valid preferences", () => {
    assertType<DateFormatPreference>("system");
    assertType<DateFormatPreference>("iso");
    assertType<DateFormatPreference>("locale");
  });

  it("rejects invalid preferences", () => {
    // @ts-expect-error invalid preference
    assertType<DateFormatPreference>("custom");
  });
});

describe("NumberFormatPreference", () => {
  it("accepts valid preferences", () => {
    assertType<NumberFormatPreference>("system");
    assertType<NumberFormatPreference>("locale");
  });

  it("rejects invalid preferences", () => {
    // @ts-expect-error invalid preference
    assertType<NumberFormatPreference>("custom");
  });
});

describe("LocaleConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<LocaleConfig["locale"]>().toEqualTypeOf<Locale>();
    expectTypeOf<LocaleConfig["fallbackLocale"]>().toEqualTypeOf<Locale>();
    expectTypeOf<LocaleConfig["textDirection"]>().toEqualTypeOf<TextDirection>();
    expectTypeOf<LocaleConfig["dateFormat"]>().toEqualTypeOf<DateFormatPreference>();
    expectTypeOf<LocaleConfig["numberFormat"]>().toEqualTypeOf<NumberFormatPreference>();
  });
});
