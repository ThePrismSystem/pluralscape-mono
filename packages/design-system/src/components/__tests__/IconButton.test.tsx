/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../theme";
import { IconButton } from "../IconButton";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

const HIT_MIN = 44;

describe("IconButton", () => {
  it("uses the accessibilityLabel for the rendered control", () => {
    render(wrap(<IconButton name="x" accessibilityLabel="Close" onPress={() => {}} />));
    expect(screen.getByLabelText("Close")).toBeDefined();
  });

  it("invokes onPress when pressed", () => {
    const onPress = vi.fn();
    render(wrap(<IconButton name="x" accessibilityLabel="Close" onPress={onPress} />));
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("renders with hit-area minimum of 44x44", () => {
    render(wrap(<IconButton name="x" accessibilityLabel="Close" onPress={() => {}} />));
    const node = screen.getByRole("button");
    expect(parseInt(node.style.minWidth, 10)).toBeGreaterThanOrEqual(HIT_MIN);
    expect(parseInt(node.style.minHeight, 10)).toBeGreaterThanOrEqual(HIT_MIN);
  });
});
