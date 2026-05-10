/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../../theme";
import { PluralscapeLogo } from "../PluralscapeLogo";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

describe("PluralscapeLogo", () => {
  it.each(["icon", "wordmark", "wordmark-dark", "wordmark-light"] as const)(
    "renders variant=%s",
    (variant) => {
      const { container } = render(wrap(<PluralscapeLogo variant={variant} />));
      expect(container.querySelector("svg")).not.toBeNull();
    },
  );

  it("respects size prop", () => {
    const { container } = render(wrap(<PluralscapeLogo variant="icon" size={64} />));
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("64");
  });
});
