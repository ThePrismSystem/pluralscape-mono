// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../react/I18nProvider.js";

import type { I18nConfig } from "../types.js";
import type { Locale } from "@pluralscape/types";

const EN = "en" as Locale;

function makeConfig(overrides?: Partial<I18nConfig>): I18nConfig {
  return {
    locale: EN,
    fallbackLocale: EN,
    resources: {
      en: { common: { greeting: "Hello, World!" } },
    },
    ...overrides,
  };
}

function TranslatedChild(): React.JSX.Element {
  const { t } = useTranslation("common");
  return <span data-testid="translated">{t("greeting")}</span>;
}

describe("I18nProvider", () => {
  afterEach(cleanup);

  it("renders children synchronously", () => {
    render(
      <I18nProvider config={makeConfig()}>
        <span data-testid="child">content</span>
      </I18nProvider>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("provides translations to child components via useTranslation", () => {
    render(
      <I18nProvider config={makeConfig()}>
        <TranslatedChild />
      </I18nProvider>,
    );

    expect(screen.getByTestId("translated").textContent).toBe("Hello, World!");
  });

  it("uses fallback locale for missing locale resources", () => {
    const config = makeConfig({
      locale: "fr" as Locale,
      fallbackLocale: EN,
      resources: {
        en: { common: { greeting: "Hello fallback" } },
      },
    });

    render(
      <I18nProvider config={config}>
        <TranslatedChild />
      </I18nProvider>,
    );

    expect(screen.getByTestId("translated").textContent).toBe("Hello fallback");
  });

  it("warn mode logs console.warn for missing keys", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    function MissingKeyChild(): React.JSX.Element {
      const { t } = useTranslation("common");
      return <span data-testid="missing">{t("nonexistent")}</span>;
    }

    render(
      <I18nProvider config={makeConfig({ missingKeyMode: "warn" })}>
        <MissingKeyChild />
      </I18nProvider>,
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("nonexistent"));
  });

  it("throw mode throws for missing keys", () => {
    function MissingKeyChild(): React.JSX.Element {
      const { t } = useTranslation("common");
      return <span>{t("nonexistent")}</span>;
    }

    expect(() =>
      render(
        <I18nProvider config={makeConfig({ missingKeyMode: "throw" })}>
          <MissingKeyChild />
        </I18nProvider>,
      ),
    ).toThrow("nonexistent");
  });
});
