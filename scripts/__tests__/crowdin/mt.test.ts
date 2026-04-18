import { describe, expect, it } from "vitest";

import {
  ENGINE_ROUTING,
  buildLanguageRoutingMap,
  validateRoutingCoverage,
} from "../../crowdin/mt.js";

describe("ENGINE_ROUTING", () => {
  it("routes ar and es-419 to Google", () => {
    expect(ENGINE_ROUTING.ar).toBe("google");
    expect(ENGINE_ROUTING["es-419"]).toBe("google");
  });

  it("routes all DeepL-supported targets to deepl", () => {
    expect(ENGINE_ROUTING.de).toBe("deepl");
    expect(ENGINE_ROUTING["pt-BR"]).toBe("deepl");
    expect(ENGINE_ROUTING["zh-Hans"]).toBe("deepl");
  });

  it("covers all 12 repo-side locales", () => {
    expect(Object.keys(ENGINE_ROUTING).sort()).toEqual([
      "ar",
      "de",
      "es",
      "es-419",
      "fr",
      "it",
      "ja",
      "ko",
      "nl",
      "pt-BR",
      "ru",
      "zh-Hans",
    ]);
  });
});

describe("validateRoutingCoverage", () => {
  it("returns no missing when all are covered", () => {
    const missing = validateRoutingCoverage(Object.keys(ENGINE_ROUTING));
    expect(missing).toEqual([]);
  });

  it("reports target language not in routing", () => {
    const missing = validateRoutingCoverage(["en", "ar", "unknown"]);
    expect(missing).toEqual(["en", "unknown"]);
  });
});

describe("buildLanguageRoutingMap", () => {
  it("groups languages by engine", () => {
    const map = buildLanguageRoutingMap();
    expect(map.deepl).toContain("de");
    expect(map.google).toEqual(["ar", "es-419"]);
    expect(map.deepl).not.toContain("ar");
  });
});
