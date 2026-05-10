/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../../theme";
import { Avatar } from "../Avatar";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

describe("Avatar", () => {
  it("renders the first uppercase letter of label as the initial in aurora fallback", () => {
    render(wrap(<Avatar label="Aria" />));
    expect(screen.getByText("A")).toBeDefined();
  });

  it("does not render an initial when label is empty", () => {
    const { container } = render(wrap(<Avatar label="" />));
    expect(container.querySelector("span")?.textContent ?? "").toBe("");
  });

  it("does not render an initial when bgColor is provided (custom-color mode)", () => {
    const { container } = render(wrap(<Avatar label="Aria" bgColor="#3a5a48" />));
    expect(container.querySelector("span")?.textContent ?? "").toBe("");
  });

  it("renders an <img> element when imageUri is provided (image mode)", () => {
    const { container } = render(wrap(<Avatar label="A" imageUri="https://example.com/a.png" />));
    expect(container.querySelector("img")).not.toBeNull();
  });

  it.each(["sm", "md", "lg"] as const)("renders size=%s without crashing", (size) => {
    render(wrap(<Avatar label="A" size={size} />));
    expect(screen.getByText("A")).toBeDefined();
  });

  it.each(["square", "circle"] as const)("renders shape=%s without crashing", (shape) => {
    render(wrap(<Avatar label="A" shape={shape} />));
    expect(screen.getByText("A")).toBeDefined();
  });
});
