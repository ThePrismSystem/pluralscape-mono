/// <reference lib="dom" />
// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "../../theme";
import { Icon } from "../Icon";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

describe("Icon", () => {
  it("renders an icon by name", () => {
    const { container } = render(wrap(<Icon name="check" />));
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses the active theme fg color when no color prop is passed", () => {
    const { container } = render(wrap(<Icon name="check" />));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("#e8e4f0");
  });

  it("respects an explicit color prop", () => {
    const { container } = render(wrap(<Icon name="check" color="#ff0000" />));
    expect(container.querySelector("svg")?.getAttribute("stroke")).toBe("#ff0000");
  });
});
