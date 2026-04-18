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
});
