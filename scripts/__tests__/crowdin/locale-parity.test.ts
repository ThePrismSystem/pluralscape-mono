import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { TARGET_LANGUAGE_IDS } from "../../crowdin/languages.js";

/**
 * Guards against drift between the three sources of truth for locale codes:
 * - `TARGET_LANGUAGE_IDS` (Crowdin-side language IDs)
 * - `apps/mobile/locales/<dir>/` (on-disk translation directories, excluding `en`)
 * - `crowdin.yml` language_mapping (explicit Crowdin → repo-dir overrides)
 *
 * If one changes and the others don't, the pipeline silently drops a locale.
 */
interface CrowdinYmlFile {
  languages_mapping?: { locale?: Record<string, string> };
}
interface CrowdinYml {
  files?: CrowdinYmlFile[];
}

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const MOBILE_LOCALES_DIR = path.join(REPO_ROOT, "apps", "mobile", "locales");
const SOURCE_LOCALE = "en";

function loadCrowdinMapping(): Record<string, string> {
  // Crowdin's CLI reads `languages_mapping` only when nested inside a file
  // entry — top-level placement is silently ignored. Read it from the first
  // (only) file entry so this test stays aligned with the production config.
  const file = path.join(REPO_ROOT, "crowdin.yml");
  const parsed = parse(readFileSync(file, "utf8")) as CrowdinYml;
  return parsed.files?.[0]?.languages_mapping?.locale ?? {};
}

function listDiskTranslationLocales(): string[] {
  return readdirSync(MOBILE_LOCALES_DIR)
    .filter((entry) => !entry.startsWith("_") && entry !== SOURCE_LOCALE)
    .filter((entry) => statSync(path.join(MOBILE_LOCALES_DIR, entry)).isDirectory());
}

function expectedDiskLocale(crowdinId: string, mapping: Record<string, string>): string {
  return mapping[crowdinId] ?? crowdinId;
}

describe("locale parity", () => {
  it("every TARGET_LANGUAGE_IDS entry maps to an on-disk locale directory via crowdin.yml", () => {
    const mapping = loadCrowdinMapping();
    const diskLocales = new Set<string>(listDiskTranslationLocales());
    const missing: Array<{ crowdin: string; expectedDisk: string }> = [];
    for (const id of TARGET_LANGUAGE_IDS) {
      const disk = expectedDiskLocale(id, mapping);
      if (!diskLocales.has(disk)) {
        missing.push({ crowdin: id, expectedDisk: disk });
      }
    }
    expect(missing).toEqual([]);
  });

  it("every on-disk translation locale directory corresponds to a TARGET_LANGUAGE_IDS entry via crowdin.yml", () => {
    const mapping = loadCrowdinMapping();
    const expectedDiskSet = new Set(
      TARGET_LANGUAGE_IDS.map((id) => expectedDiskLocale(id, mapping)),
    );
    const orphanedDiskLocales = listDiskTranslationLocales().filter((l) => !expectedDiskSet.has(l));
    expect(orphanedDiskLocales).toEqual([]);
  });
});
