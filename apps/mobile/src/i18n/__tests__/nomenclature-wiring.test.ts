import { describe, expect, it } from "vitest";

import { resolveNomenclatureFromSettings } from "../nomenclature-wiring.js";

describe("resolveNomenclatureFromSettings", () => {
  it("returns empty object for null settings", () => {
    expect(resolveNomenclatureFromSettings(null)).toEqual({});
  });

  it("returns empty object when no nomenclature fields are set", () => {
    expect(resolveNomenclatureFromSettings({})).toEqual({});
  });

  it("returns only system when only systemNomenclature is set", () => {
    expect(resolveNomenclatureFromSettings({ systemNomenclature: "collective" })).toEqual({
      system: "collective",
    });
  });

  it("returns only member when only memberNomenclature is set", () => {
    expect(resolveNomenclatureFromSettings({ memberNomenclature: "headmate" })).toEqual({
      member: "headmate",
    });
  });

  it("returns both when both fields are set", () => {
    expect(
      resolveNomenclatureFromSettings({
        systemNomenclature: "collective",
        memberNomenclature: "headmate",
      }),
    ).toEqual({ system: "collective", member: "headmate" });
  });
});
