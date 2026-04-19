import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { ALLOWED_LOCALES } from "../../crowdin/automerge/evaluate.js";
import { TARGET_LANGUAGE_IDS } from "../../crowdin/languages.js";

/**
 * Guards against drift between the three sources of truth for locale codes:
 * - `TARGET_LANGUAGE_IDS` (Crowdin-side language IDs)
 * - `ALLOWED_LOCALES` (on-disk locale directory names allowed for auto-merge)
 * - `crowdin.yml` language_mapping (explicit Crowdin → repo-dir overrides)
 *
 * If one changes and the others don't, the pipeline silently drops a locale.
 */
interface CrowdinYmlMapping {
  languages_mapping?: { locale?: Record<string, string> };
}

function loadCrowdinMapping(): Record<string, string> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const file = path.join(repoRoot, "crowdin.yml");
  const parsed = parse(readFileSync(file, "utf8")) as CrowdinYmlMapping;
  return parsed.languages_mapping?.locale ?? {};
}

function expectedDiskLocale(crowdinId: string, mapping: Record<string, string>): string {
  return mapping[crowdinId] ?? crowdinId;
}

describe("locale parity", () => {
  it("every TARGET_LANGUAGE_IDS entry maps to an ALLOWED_LOCALES entry via crowdin.yml", () => {
    const mapping = loadCrowdinMapping();
    const allowedSet = new Set<string>(ALLOWED_LOCALES);
    const missing: Array<{ crowdin: string; expectedDisk: string }> = [];
    for (const id of TARGET_LANGUAGE_IDS) {
      const disk = expectedDiskLocale(id, mapping);
      if (!allowedSet.has(disk)) {
        missing.push({ crowdin: id, expectedDisk: disk });
      }
    }
    expect(missing).toEqual([]);
  });

  it("every ALLOWED_LOCALES entry corresponds to a TARGET_LANGUAGE_IDS entry via crowdin.yml", () => {
    const mapping = loadCrowdinMapping();
    const expectedDiskSet = new Set(
      TARGET_LANGUAGE_IDS.map((id) => expectedDiskLocale(id, mapping)),
    );
    const orphanedDiskLocales = ALLOWED_LOCALES.filter((l) => !expectedDiskSet.has(l));
    expect(orphanedDiskLocales).toEqual([]);
  });
});
