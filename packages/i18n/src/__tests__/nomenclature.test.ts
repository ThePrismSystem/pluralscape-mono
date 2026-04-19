import {
  type CanonicalTerm,
  DEFAULT_TERM_PRESETS,
  type NomenclatureSettings,
  type TermCategory,
} from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_TERMS,
  PRESET_PLURAL_RULES,
  resolveTerm,
  resolveTermLower,
  resolveTermPlural,
  resolveTermTitle,
  resolveTermUpper,
} from "../nomenclature.js";

const EXPECTED_CATEGORY_COUNT = 12;

function makeSettings(overrides: Partial<Record<TermCategory, string>> = {}): NomenclatureSettings {
  const base: Record<string, string> = {};
  for (const preset of DEFAULT_TERM_PRESETS) {
    base[preset.category] = preset.default;
  }
  return { ...base, ...overrides } as NomenclatureSettings;
}

describe("CANONICAL_TERMS", () => {
  it("has all 12 entries", () => {
    expect(Object.keys(CANONICAL_TERMS)).toHaveLength(EXPECTED_CATEGORY_COUNT);
  });

  it("uses SCREAMING_SNAKE keys matching categories", () => {
    expect(CANONICAL_TERMS.COLLECTIVE).toEqual({
      key: "collective",
      category: "collective",
      defaultValue: "System",
    });
    expect(CANONICAL_TERMS.INDIVIDUAL).toEqual({
      key: "individual",
      category: "individual",
      defaultValue: "Member",
    });
    expect(CANONICAL_TERMS.CO_PRESENCE).toEqual({
      key: "co-presence",
      category: "co-presence",
      defaultValue: "Co-fronting",
    });
    expect(CANONICAL_TERMS.INTERNAL_SPACE).toEqual({
      key: "internal-space",
      category: "internal-space",
      defaultValue: "Headspace",
    });
    expect(CANONICAL_TERMS.PRIMARY_FRONTER).toEqual({
      key: "primary-fronter",
      category: "primary-fronter",
      defaultValue: "Host",
    });
  });

  it("has correct default values for all categories", () => {
    for (const preset of DEFAULT_TERM_PRESETS) {
      const key = preset.category.toUpperCase().replace(/-/g, "_") as keyof typeof CANONICAL_TERMS;
      const term = CANONICAL_TERMS[key];
      expect(term.category).toBe(preset.category);
      expect(term.defaultValue).toBe(preset.default);
    }
  });
});

describe("resolveTerm", () => {
  it("returns custom value from settings", () => {
    const settings = makeSettings({ collective: "Household" });
    const result = resolveTerm(CANONICAL_TERMS.COLLECTIVE, settings);
    expect(result).toBe("Household");
  });

  it("falls back to default when settings is null", () => {
    const result = resolveTerm(CANONICAL_TERMS.COLLECTIVE, null);
    expect(result).toBe("System");
  });

  it("falls back to default when settings is undefined", () => {
    const result = resolveTerm(CANONICAL_TERMS.COLLECTIVE, undefined);
    expect(result).toBe("System");
  });

  it("falls back when category value is empty string", () => {
    const settings = makeSettings({ collective: "" });
    const result = resolveTerm(CANONICAL_TERMS.COLLECTIVE, settings);
    expect(result).toBe("System");
  });
});

describe("resolveTermLower", () => {
  it("lowercases the resolved term", () => {
    const result = resolveTermLower(CANONICAL_TERMS.COLLECTIVE, null);
    expect(result).toBe("system");
  });

  it("lowercases a custom term", () => {
    const settings = makeSettings({ collective: "Household" });
    const result = resolveTermLower(CANONICAL_TERMS.COLLECTIVE, settings);
    expect(result).toBe("household");
  });
});

describe("resolveTermTitle", () => {
  it("title-cases multi-word terms", () => {
    const settings = makeSettings({ structure: "system map" });
    const result = resolveTermTitle(CANONICAL_TERMS.STRUCTURE, settings);
    expect(result).toBe("System Map");
  });

  it("preserves hyphenated words", () => {
    const result = resolveTermTitle(CANONICAL_TERMS.CO_PRESENCE, null);
    expect(result).toBe("Co-fronting");
  });

  it("title-cases default terms", () => {
    const result = resolveTermTitle(CANONICAL_TERMS.COLLECTIVE, null);
    expect(result).toBe("System");
  });
});

describe("resolveTermUpper", () => {
  it("uppercases the resolved term", () => {
    const result = resolveTermUpper(CANONICAL_TERMS.COLLECTIVE, null);
    expect(result).toBe("SYSTEM");
  });

  it("uppercases a custom term", () => {
    const settings = makeSettings({ individual: "headmate" });
    const result = resolveTermUpper(CANONICAL_TERMS.INDIVIDUAL, settings);
    expect(result).toBe("HEADMATE");
  });
});

describe("resolveTermPlural", () => {
  it("returns correct plural for each of the 12 default terms", () => {
    const expected: Record<string, string> = {
      COLLECTIVE: "Systems",
      INDIVIDUAL: "Members",
      FRONTING: "Fronting",
      SWITCHING: "Switches",
      CO_PRESENCE: "Co-fronting",
      INTERNAL_SPACE: "Headspaces",
      PRIMARY_FRONTER: "Hosts",
      STRUCTURE: "System Structures",
      DORMANCY: "Dormancies",
      BODY: "Bodies",
      AMNESIA: "Amnesias",
      SATURATION: "Saturations",
    };
    for (const [key, expectedPlural] of Object.entries(expected)) {
      const term = CANONICAL_TERMS[key as keyof typeof CANONICAL_TERMS];
      const result = resolveTermPlural(term, null);
      expect(result).toBe(expectedPlural);
    }
  });

  it("handles custom term with regular +s heuristic", () => {
    const term: CanonicalTerm = {
      key: "collective",
      category: "collective",
      defaultValue: "System",
    };
    const settings = makeSettings({ collective: "Team" });
    expect(resolveTermPlural(term, settings)).toBe("Teams");
  });

  it("handles custom term with y→ies heuristic", () => {
    const term: CanonicalTerm = {
      key: "collective",
      category: "collective",
      defaultValue: "System",
    };
    const settings = makeSettings({ collective: "Party" });
    expect(resolveTermPlural(term, settings)).toBe("Parties");
  });

  it("handles custom term with ch→ches heuristic", () => {
    const term: CanonicalTerm = {
      key: "switching",
      category: "switching",
      defaultValue: "Switch",
    };
    const settings = makeSettings({ switching: "Latch" });
    expect(resolveTermPlural(term, settings)).toBe("Latches");
  });

  it("returns invariant forms unchanged for gerunds", () => {
    expect(resolveTermPlural(CANONICAL_TERMS.FRONTING, null)).toBe("Fronting");
    const settings = makeSettings({ fronting: "Driving" });
    expect(resolveTermPlural(CANONICAL_TERMS.FRONTING, settings)).toBe("Driving");
  });

  it("returns invariant forms unchanged for adjective states", () => {
    const settings = makeSettings({ "co-presence": "Co-conscious" });
    expect(resolveTermPlural(CANONICAL_TERMS.CO_PRESENCE, settings)).toBe("Co-conscious");
  });

  it("with null settings falls back to default then pluralizes", () => {
    const result = resolveTermPlural(CANONICAL_TERMS.INDIVIDUAL, null);
    expect(result).toBe("Members");
  });

  it("handles custom term with sh ending via heuristic", () => {
    const settings = makeSettings({ collective: "Wish" });
    expect(resolveTermPlural(CANONICAL_TERMS.COLLECTIVE, settings)).toBe("Wishes");
  });

  it("handles custom term with s ending via heuristic", () => {
    const settings = makeSettings({ collective: "Focus" });
    expect(resolveTermPlural(CANONICAL_TERMS.COLLECTIVE, settings)).toBe("Focuses");
  });

  it("handles custom term with x ending via heuristic", () => {
    const settings = makeSettings({ collective: "Box" });
    expect(resolveTermPlural(CANONICAL_TERMS.COLLECTIVE, settings)).toBe("Boxes");
  });

  it("handles custom term with z ending via heuristic", () => {
    const settings = makeSettings({ collective: "Buzz" });
    expect(resolveTermPlural(CANONICAL_TERMS.COLLECTIVE, settings)).toBe("Buzzes");
  });

  it("handles multi-word custom term via heuristic", () => {
    const settings = makeSettings({ collective: "Inner team" });
    expect(resolveTermPlural(CANONICAL_TERMS.COLLECTIVE, settings)).toBe("Inner teams");
  });

  it("PRESET_PLURAL_RULES covers every preset value in DEFAULT_TERM_PRESETS", () => {
    for (const preset of DEFAULT_TERM_PRESETS) {
      for (const value of preset.presets) {
        expect(PRESET_PLURAL_RULES[value]?.length).toBeGreaterThan(0);
      }
    }
  });
});
