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
    assertType<TermCategory>("collective");
    assertType<TermCategory>("individual");
    assertType<TermCategory>("fronting");
    assertType<TermCategory>("switching");
    assertType<TermCategory>("co-presence");
    assertType<TermCategory>("internal-space");
    assertType<TermCategory>("primary-fronter");
    assertType<TermCategory>("structure");
  });

  it("rejects invalid categories", () => {
    // @ts-expect-error invalid category
    assertType<TermCategory>("identity");
  });

  it("is exhaustive in a switch", () => {
    function handleCategory(category: TermCategory): string {
      switch (category) {
        case "collective":
        case "individual":
        case "fronting":
        case "switching":
        case "co-presence":
        case "internal-space":
        case "primary-fronter":
        case "structure":
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
    expectTypeOf<CanonicalTerm["key"]>().toEqualTypeOf<string>();
    expectTypeOf<CanonicalTerm["category"]>().toEqualTypeOf<TermCategory>();
    expectTypeOf<CanonicalTerm["defaultValue"]>().toEqualTypeOf<string>();
  });
});

describe("NomenclatureSettings", () => {
  it("is a readonly record of TermCategory to string", () => {
    expectTypeOf<NomenclatureSettings>().toEqualTypeOf<Readonly<Record<TermCategory, string>>>();
  });

  it("requires all 8 categories", () => {
    expectTypeOf<NomenclatureSettings["collective"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["individual"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["fronting"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["switching"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["co-presence"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["internal-space"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["primary-fronter"]>().toEqualTypeOf<string>();
    expectTypeOf<NomenclatureSettings["structure"]>().toEqualTypeOf<string>();
  });
});

describe("TermPreset", () => {
  it("has correct field types", () => {
    expectTypeOf<TermPreset["category"]>().toEqualTypeOf<TermCategory>();
    expectTypeOf<TermPreset["presets"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<TermPreset["default"]>().toEqualTypeOf<string>();
  });
});

describe("DEFAULT_TERM_PRESETS", () => {
  it("is a readonly array of TermPreset", () => {
    expectTypeOf(DEFAULT_TERM_PRESETS).toExtend<readonly TermPreset[]>();
  });

  it("contains one preset per category", () => {
    expect(DEFAULT_TERM_PRESETS).toHaveLength(8);
    const categories = DEFAULT_TERM_PRESETS.map((p) => p.category);
    expect(categories).toContain("collective");
    expect(categories).toContain("individual");
    expect(categories).toContain("fronting");
    expect(categories).toContain("switching");
    expect(categories).toContain("co-presence");
    expect(categories).toContain("internal-space");
    expect(categories).toContain("primary-fronter");
    expect(categories).toContain("structure");
  });

  it("has non-empty preset arrays", () => {
    for (const preset of DEFAULT_TERM_PRESETS) {
      expect(preset.presets.length).toBeGreaterThan(0);
      expect(preset.presets).toContain(preset.default);
    }
  });
});

describe("createDefaultNomenclatureSettings", () => {
  it("returns NomenclatureSettings", () => {
    expectTypeOf(createDefaultNomenclatureSettings).toBeFunction();
    expectTypeOf(createDefaultNomenclatureSettings()).toEqualTypeOf<NomenclatureSettings>();
  });

  it("uses default term for each category", () => {
    const settings = createDefaultNomenclatureSettings();
    expect(settings.collective).toBe("System");
    expect(settings.individual).toBe("Member");
    expect(settings.fronting).toBe("Fronting");
    expect(settings.switching).toBe("Switch");
    expect(settings["co-presence"]).toBe("Co-fronting");
    expect(settings["internal-space"]).toBe("Headspace");
    expect(settings["primary-fronter"]).toBe("Host");
    expect(settings.structure).toBe("System Structure");
  });
});
