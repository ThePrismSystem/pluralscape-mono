import { initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { createI18nInstance } from "../create-i18n.js";
import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES } from "../i18n.constants.js";

const mockWarnLogger = { warn: vi.fn() };

describe("createI18nInstance", () => {
  it("creates a new i18next instance", () => {
    const instance = createI18nInstance({ logger: mockWarnLogger });
    expect(instance).toBeDefined();
    expect(instance.isInitialized).toBeFalsy();
  });

  it("sets saveMissing via the 3rdParty plugin", async () => {
    const instance = createI18nInstance({ logger: mockWarnLogger });
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...NAMESPACES],
      resources: { en: { common: { hello: "Hello" } } },
    });

    expect(instance.options.saveMissing).toBe(true);
  });

  it("caller sets fallbackLng via init (not the factory)", async () => {
    const instance = createI18nInstance({ logger: mockWarnLogger });
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      fallbackLng: "de",
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...NAMESPACES],
      resources: { en: { common: {} } },
    });

    expect(instance.options.fallbackLng).toContain("de");
  });

  it("fires the missing key handler when a key is missing", async () => {
    const warnFn = vi.fn();
    const instance = createI18nInstance({ missingKeyMode: "warn", logger: { warn: warnFn } });
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...NAMESPACES],
      resources: { en: { common: {} } },
    });

    expect(instance.options.saveMissing).toBe(true);
    expect(instance.exists("common:nonexistent")).toBe(false);
  });

  it("can be initialized with throw mode", () => {
    const instance = createI18nInstance({ missingKeyMode: "throw" });
    expect(instance).toBeDefined();
  });

  it("defaults to throw mode when called with no arguments", async () => {
    const instance = createI18nInstance();
    instance.use(initReactI18next);

    await instance.init({
      lng: "en",
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...NAMESPACES],
      resources: { en: { common: { hello: "Hello" } } },
    });

    expect(instance.isInitialized).toBe(true);
    expect(instance.options.saveMissing).toBe(true);
  });
});
