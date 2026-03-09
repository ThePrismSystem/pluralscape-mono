import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { createDefaultNomenclatureSettings, DEFAULT_TERM_PRESETS } from "../nomenclature.js";

import type {
  CanonicalTerm,
  NomenclatureSettings,
  TermCategory,
  TermPreset,
} from "../nomenclature.js";

describe("TermCategory", () => {
  it("accepts valid categories", () => {
    assertType<TermCategory>("identity");
    assertType<TermCategory>("fronting");
    assertType<TermCategory>("structure");
    assertType<TermCategory>("communication");
    assertType<TermCategory>("privacy");
  });

  it("rejects invalid categories", () => {
    // @ts-expect-error invalid category
    assertType<TermCategory>("other");
  });

  it("is exhaustive in a switch", () => {
    function handleCategory(category: TermCategory): string {
      switch (category) {
        case "identity":
        case "fronting":
        case "structure":
        case "communication":
        case "privacy":
          return category;
        default: {
          const _exhaustive: never = category;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleCategory).toBeFunction();
  });
});

describe("CanonicalTerm", () => {
  it("has correct field types", () => {
    expectTypeOf<CanonicalTerm["key"]>().toBeString();
    expectTypeOf<CanonicalTerm["category"]>().toEqualTypeOf<TermCategory>();
    expectTypeOf<CanonicalTerm["defaultValue"]>().toBeString();
  });
});

describe("NomenclatureSettings", () => {
  it("has preset as string", () => {
    expectTypeOf<NomenclatureSettings["preset"]>().toBeString();
  });

  it("has overrides as readonly record", () => {
    expectTypeOf<NomenclatureSettings["overrides"]>().toEqualTypeOf<
      Readonly<Record<string, string>>
    >();
  });
});

describe("TermPreset", () => {
  it("has correct field types", () => {
    expectTypeOf<TermPreset["name"]>().toBeString();
    expectTypeOf<TermPreset["label"]>().toBeString();
    expectTypeOf<TermPreset["terms"]>().toEqualTypeOf<Readonly<Record<string, string>>>();
  });
});

describe("DEFAULT_TERM_PRESETS", () => {
  it("is a readonly array of TermPreset", () => {
    expectTypeOf(DEFAULT_TERM_PRESETS).toExtend<readonly TermPreset[]>();
  });

  it("contains community and clinical presets", () => {
    expect(DEFAULT_TERM_PRESETS).toHaveLength(2);
    expect(DEFAULT_TERM_PRESETS[0]?.name).toBe("community");
    expect(DEFAULT_TERM_PRESETS[1]?.name).toBe("clinical");
  });
});

describe("createDefaultNomenclatureSettings", () => {
  it("returns NomenclatureSettings", () => {
    expectTypeOf(createDefaultNomenclatureSettings).toBeFunction();
    expectTypeOf(createDefaultNomenclatureSettings()).toEqualTypeOf<NomenclatureSettings>();
  });

  it("uses community preset by default", () => {
    const settings = createDefaultNomenclatureSettings();
    expect(settings.preset).toBe("community");
    expect(settings.overrides).toEqual({});
  });
});
