/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../theme";
import { Switch } from "../Switch";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

describe("Switch", () => {
  it("renders with the on state when value=true", () => {
    render(wrap(<Switch value={true} onValueChange={() => {}} accessibilityLabel="Toggle" />));
    expect(screen.getByLabelText("Toggle").getAttribute("aria-checked")).toBe("true");
  });

  it("renders with the off state when value=false", () => {
    render(wrap(<Switch value={false} onValueChange={() => {}} accessibilityLabel="Toggle" />));
    expect(screen.getByLabelText("Toggle").getAttribute("aria-checked")).toBe("false");
  });

  it("invokes onValueChange when toggled", () => {
    const fn = vi.fn();
    render(wrap(<Switch value={false} onValueChange={fn} accessibilityLabel="Toggle" />));
    fireEvent.click(screen.getByLabelText("Toggle"));
    expect(fn).toHaveBeenCalledWith(true);
  });
});
