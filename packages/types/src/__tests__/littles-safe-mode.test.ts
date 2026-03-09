import { describe, expectTypeOf, it } from "vitest";

import type { EntityType } from "../ids.js";
import type {
  LittlesSafeModeConfig,
  SafeModeContentItem,
  SafeModeUIFlags,
} from "../littles-safe-mode.js";

describe("SafeModeUIFlags", () => {
  it("has all boolean flag fields", () => {
    expectTypeOf<SafeModeUIFlags["hideAnalytics"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["hideJournal"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["hideInnerworld"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["hideCustomFields"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["simplifiedNavigation"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["largerTouchTargets"]>().toEqualTypeOf<boolean>();
  });
});

describe("SafeModeContentItem", () => {
  it("has correct field types", () => {
    expectTypeOf<SafeModeContentItem["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<SafeModeContentItem["label"]>().toBeString();
    expectTypeOf<SafeModeContentItem["visible"]>().toEqualTypeOf<boolean>();
  });
});

describe("LittlesSafeModeConfig", () => {
  it("has enabled boolean", () => {
    expectTypeOf<LittlesSafeModeConfig["enabled"]>().toEqualTypeOf<boolean>();
  });

  it("has uiFlags as SafeModeUIFlags", () => {
    expectTypeOf<LittlesSafeModeConfig["uiFlags"]>().toEqualTypeOf<SafeModeUIFlags>();
  });

  it("has hiddenContent as readonly array", () => {
    expectTypeOf<LittlesSafeModeConfig["hiddenContent"]>().toEqualTypeOf<
      readonly SafeModeContentItem[]
    >();
  });
});
