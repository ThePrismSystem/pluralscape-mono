import { describe, expect, it } from "vitest";

import { TARGET_LANGUAGE_IDS, type TargetLanguageId } from "../../crowdin/languages.js";
import { ENGINE_ROUTING } from "../../crowdin/mt.js";

describe("ENGINE_ROUTING", () => {
  it("covers every TargetLanguageId exactly once", () => {
    const routedKeys = Object.keys(ENGINE_ROUTING).sort();
    const targetKeys = [...TARGET_LANGUAGE_IDS].sort();
    expect(routedKeys).toEqual(targetKeys);
  });

  it("routes es-419 and ar to Google, everything else to DeepL", () => {
    const byEngine: Record<"deepl" | "google", TargetLanguageId[]> = { deepl: [], google: [] };
    for (const [id, engine] of Object.entries(ENGINE_ROUTING) as Array<
      [TargetLanguageId, "deepl" | "google"]
    >) {
      byEngine[engine].push(id);
    }
    expect(byEngine.google.sort()).toEqual(["ar", "es-419"]);
    expect(byEngine.deepl.sort()).toEqual([
      "de",
      "es-ES",
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
