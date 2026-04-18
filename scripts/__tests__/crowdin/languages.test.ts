import { describe, expect, it } from "vitest";

import { TARGET_LANGUAGE_IDS, diffLanguages } from "../../crowdin/languages.js";

describe("TARGET_LANGUAGE_IDS", () => {
  it("contains all 12 target languages", () => {
    expect(TARGET_LANGUAGE_IDS).toEqual([
      "ar",
      "de",
      "es-ES",
      "es-419",
      "fr",
      "it",
      "ja",
      "ko",
      "nl",
      "pt-BR",
      "ru",
      "zh-CN",
    ]);
  });
});

describe("diffLanguages", () => {
  it("reports no-op when already matching", () => {
    const diff = diffLanguages(["ar", "de"], ["ar", "de"]);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
    expect(diff.unchanged).toHaveLength(2);
  });

  it("reports additions", () => {
    const diff = diffLanguages(["ar", "de", "fr"], ["ar"]);
    expect(diff.toAdd).toEqual(["de", "fr"]);
    expect(diff.toRemove).toEqual([]);
  });

  it("reports removals", () => {
    const diff = diffLanguages(["ar"], ["ar", "de"]);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual(["de"]);
  });

  it("handles both adds and removes", () => {
    const diff = diffLanguages(["ar", "fr"], ["ar", "de"]);
    expect(diff.toAdd).toEqual(["fr"]);
    expect(diff.toRemove).toEqual(["de"]);
  });
});
