import { afterEach, describe, it, expect, vi } from "vitest";

import { loadBundledNamespace, BUNDLED_LOCALES, BUNDLED_NAMESPACES } from "../index.js";

describe("bundled locale loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists all 13 SUPPORTED_LOCALES as bundled", () => {
    expect([...BUNDLED_LOCALES].sort()).toEqual(
      [
        "ar",
        "de",
        "en",
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
      ].sort(),
    );
  });

  it("BUNDLED_NAMESPACES includes at minimum common, auth, fronting, members, settings", () => {
    expect(BUNDLED_NAMESPACES).toEqual(
      expect.arrayContaining(["common", "auth", "fronting", "members", "settings"]),
    );
  });

  it("loads en/common successfully", async () => {
    const data = await loadBundledNamespace("en", "common");
    expect(data.appName).toBe("Pluralscape");
  });

  it("returns empty object for unknown locale (graceful)", async () => {
    const data = await loadBundledNamespace("xx-UNKNOWN", "common");
    expect(data).toEqual({});
  });

  it("returns empty object for unknown namespace (graceful)", async () => {
    const data = await loadBundledNamespace("en", "nonexistent");
    expect(data).toEqual({});
  });

  it("console.warns on import failure before returning empty object", async () => {
    const warnSpy = vi.spyOn(globalThis.console, "warn").mockImplementation(() => undefined);
    const data = await loadBundledNamespace("xx-UNKNOWN", "common");
    expect(data).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "bundled namespace load failed: xx-UNKNOWN/common",
      expect.anything(),
    );
  });

  // Exhaustive matrix of every shipped locale × namespace pair. Guards against
  // a malformed JSON file (e.g. an accidentally-nested object, or a key with a
  // non-string value from a bad Crowdin export) sneaking into the bundle.
  // One failing cell pinpoints exactly which locale/namespace file is broken.
  it.each(
    BUNDLED_LOCALES.flatMap((locale) =>
      BUNDLED_NAMESPACES.map((namespace) => [locale, namespace] as const),
    ),
  )("loads %s/%s as an object of string values", async (locale, namespace) => {
    const bundle = await loadBundledNamespace(locale, namespace);
    expect(typeof bundle).toBe("object");
    expect(bundle).not.toBeNull();
    for (const value of Object.values(bundle)) {
      expect(typeof value).toBe("string");
    }
  });
});
