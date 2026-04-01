import { describe, expect, it, vi } from "vitest";

import { createLazyBackend } from "../lazy-backend.js";
import { resolveNomenclatureFromSettings } from "../nomenclature-wiring.js";

describe("createLazyBackend", () => {
  it("returns a plugin with type 'backend'", () => {
    const backend = createLazyBackend({
      loadNamespace: vi.fn().mockResolvedValue({}),
    });
    expect(backend.type).toBe("backend");
  });

  it("loads namespace on demand and calls callback with data", async () => {
    const translations = { hello: "Hello" };
    const loadNamespace = vi.fn().mockResolvedValue(translations);
    const backend = createLazyBackend({ loadNamespace });

    await new Promise<void>((resolve, reject) => {
      backend.read("en", "common", (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        expect(data).toEqual(translations);
        expect(loadNamespace).toHaveBeenCalledWith("en", "common");
        resolve();
      });
    });
  });

  it("calls callback with error when loadNamespace rejects with an Error", async () => {
    const cause = new Error("load failed");
    const backend = createLazyBackend({
      loadNamespace: vi.fn().mockRejectedValue(cause),
    });

    await new Promise<void>((resolve) => {
      backend.read("en", "common", (err, data) => {
        expect(err).toBe(cause);
        expect(data).toEqual({});
        resolve();
      });
    });
  });

  it("wraps non-Error rejections in an Error", async () => {
    const backend = createLazyBackend({
      loadNamespace: vi.fn().mockRejectedValue("network error"),
    });

    await new Promise<void>((resolve) => {
      backend.read("en", "common", (err, data) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe("network error");
        expect(data).toEqual({});
        resolve();
      });
    });
  });
});

describe("resolveNomenclatureFromSettings", () => {
  it("returns empty object when settings is null", () => {
    expect(resolveNomenclatureFromSettings(null)).toEqual({});
  });

  it("returns empty object when no nomenclature keys are set", () => {
    expect(resolveNomenclatureFromSettings({})).toEqual({});
  });

  it("maps systemNomenclature to system key", () => {
    expect(resolveNomenclatureFromSettings({ systemNomenclature: "Collective" })).toEqual({
      system: "Collective",
    });
  });

  it("maps memberNomenclature to member key", () => {
    expect(resolveNomenclatureFromSettings({ memberNomenclature: "Headmate" })).toEqual({
      member: "Headmate",
    });
  });

  it("maps both keys when both are provided", () => {
    expect(
      resolveNomenclatureFromSettings({
        systemNomenclature: "Collective",
        memberNomenclature: "Headmate",
      }),
    ).toEqual({ system: "Collective", member: "Headmate" });
  });
});
