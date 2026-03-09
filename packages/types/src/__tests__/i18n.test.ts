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

  it("is not assignable to TranslationKey", () => {
    // @ts-expect-error different brand
    assertType<TranslationKey>({} as Locale);
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

  it("is not assignable to Locale", () => {
    // @ts-expect-error different brand
    assertType<Locale>({} as TranslationKey);
  });
});

describe("TranslationMap", () => {
  it("is a readonly record keyed by TranslationKey", () => {
    expectTypeOf<TranslationMap>().toEqualTypeOf<Readonly<Record<TranslationKey, string>>>();
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

  it("is exhaustive in a switch", () => {
    function handleDirection(dir: TextDirection): string {
      switch (dir) {
        case "ltr":
        case "rtl":
          return dir;
        default: {
          const _exhaustive: never = dir;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleDirection).toBeFunction();
  });
});

describe("DateFormatPreference", () => {
  it("accepts valid preferences", () => {
    assertType<DateFormatPreference>("iso");
    assertType<DateFormatPreference>("us");
    assertType<DateFormatPreference>("eu");
    assertType<DateFormatPreference>("relative");
  });

  it("rejects invalid preferences", () => {
    // @ts-expect-error invalid preference
    assertType<DateFormatPreference>("system");
  });

  it("is exhaustive in a switch", () => {
    function handleFormat(fmt: DateFormatPreference): string {
      switch (fmt) {
        case "iso":
        case "us":
        case "eu":
        case "relative":
          return fmt;
        default: {
          const _exhaustive: never = fmt;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleFormat).toBeFunction();
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

  it("is exhaustive in a switch", () => {
    function handleFormat(fmt: NumberFormatPreference): string {
      switch (fmt) {
        case "system":
        case "locale":
          return fmt;
        default: {
          const _exhaustive: never = fmt;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleFormat).toBeFunction();
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
