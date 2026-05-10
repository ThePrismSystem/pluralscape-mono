/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../theme";
import { Button } from "../Button";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

describe("Button", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the children as label", () => {
    render(wrap(<Button onPress={() => {}}>Save</Button>));
    expect(screen.getByText("Save")).toBeDefined();
  });

  it("invokes onPress when pressed", () => {
    const onPress = vi.fn();
    render(wrap(<Button onPress={onPress}>Save</Button>));
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("does not invoke onPress when disabled", () => {
    const onPress = vi.fn();
    render(
      wrap(
        <Button onPress={onPress} disabled>
          Save
        </Button>,
      ),
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "renders variant=%s without crashing",
    (variant) => {
      render(
        wrap(
          <Button onPress={() => {}} variant={variant}>
            X
          </Button>,
        ),
      );
      expect(screen.getByRole("button")).toBeDefined();
    },
  );

  it.each(["md", "lg"] as const)("renders size=%s without crashing", (size) => {
    render(
      wrap(
        <Button onPress={() => {}} size={size}>
          X
        </Button>,
      ),
    );
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("uses accessibilityLabel when provided", () => {
    render(
      wrap(
        <Button onPress={() => {}} accessibilityLabel="Save changes">
          Save
        </Button>,
      ),
    );
    expect(screen.getByLabelText("Save changes")).toBeDefined();
  });
});
