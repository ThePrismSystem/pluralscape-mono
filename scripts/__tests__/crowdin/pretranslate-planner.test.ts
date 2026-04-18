import { describe, expect, it } from "vitest";

import { TARGET_LANGUAGE_IDS } from "../../crowdin/languages.js";
import { planPretranslatePasses } from "../../crowdin/pretranslate.js";

describe("planPretranslatePasses", () => {
  const defaultOpts = { deeplMtId: 111, googleMtId: 222 };

  it("returns 3 passes (TM + DeepL + Google) when all 12 target languages are requested", () => {
    const passes = planPretranslatePasses({ ...defaultOpts, languageIds: TARGET_LANGUAGE_IDS });
    expect(passes.map((p) => p.label)).toEqual(["TM", "MT (DeepL)", "MT (Google)"]);
    expect(passes[0]?.method).toBe("tm");
    expect(passes[1]?.method).toBe("mt");
    expect(passes[1]?.engineId).toBe(111);
    expect(passes[2]?.engineId).toBe(222);
  });

  it("returns TM + DeepL only when no Google-routed languages are requested", () => {
    const passes = planPretranslatePasses({ ...defaultOpts, languageIds: ["de", "fr"] });
    expect(passes.map((p) => p.label)).toEqual(["TM", "MT (DeepL)"]);
    expect(passes[1]?.languageIds).toEqual(["de", "fr"]);
  });

  it("returns TM + Google only when only Google-routed languages are requested", () => {
    const passes = planPretranslatePasses({ ...defaultOpts, languageIds: ["ar", "es-419"] });
    expect(passes.map((p) => p.label)).toEqual(["TM", "MT (Google)"]);
    expect(passes[1]?.languageIds).toEqual(["ar", "es-419"]);
  });

  it("defaults to all 12 target languages when languageIds is omitted", () => {
    const passes = planPretranslatePasses(defaultOpts);
    expect(passes[0]?.languageIds).toHaveLength(12);
    expect(passes).toHaveLength(3);
  });

  it("threads engineId onto the MT passes", () => {
    const passes = planPretranslatePasses({
      deeplMtId: 7,
      googleMtId: 9,
      languageIds: ["ar", "de"],
    });
    const deeplPass = passes.find((p) => p.label === "MT (DeepL)");
    const googlePass = passes.find((p) => p.label === "MT (Google)");
    expect(deeplPass?.engineId).toBe(7);
    expect(googlePass?.engineId).toBe(9);
  });

  it("does not emit an MT pass when no languages fall under that engine", () => {
    const passes = planPretranslatePasses({ ...defaultOpts, languageIds: ["de"] });
    expect(passes.find((p) => p.label === "MT (Google)")).toBeUndefined();
  });
});
