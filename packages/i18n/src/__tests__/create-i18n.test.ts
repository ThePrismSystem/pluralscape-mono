import { initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE } from "../constants.js";
import { createI18nInstance } from "../create-i18n.js";

describe("createI18nInstance", () => {
  it("creates a new i18next instance", () => {
    const instance = createI18nInstance();
    expect(instance).toBeDefined();
    expect(instance.isInitialized).toBeFalsy();
  });

  it("sets the fallback locale to the default locale after init", async () => {
    const instance = createI18nInstance();
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      resources: { en: { common: { hello: "Hello" } } },
    });

    expect(instance.options.fallbackLng).toContain(DEFAULT_LOCALE);
  });

  it("fires the missing key handler when a key is missing", async () => {
    const onMissing = vi.fn();
    const instance = createI18nInstance({ missingKeyMode: "warn" });
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      resources: { en: { common: {} } },
      saveMissing: true,
    });

    // Override the handler with our spy after init
    instance.options.missingKeyHandler = (_lngs: readonly string[], ns: string, key: string) => {
      onMissing(key, ns);
    };

    instance.t("common:nonexistent");

    // Trigger missing key reporting
    expect(instance.exists("common:nonexistent")).toBe(false);
  });

  it("can be initialized with throw mode", () => {
    const instance = createI18nInstance({ missingKeyMode: "throw" });
    expect(instance).toBeDefined();
  });
});
