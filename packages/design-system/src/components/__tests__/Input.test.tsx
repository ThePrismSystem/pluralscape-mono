/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../theme";
import { Input } from "../Input";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

describe("Input", () => {
  it("renders with a label", () => {
    render(wrap(<Input label="Email" value="" onChangeText={() => {}} />));
    expect(screen.getByText("Email").textContent).toBe("Email");
  });

  it("invokes onChangeText", () => {
    const fn = vi.fn();
    render(wrap(<Input label="Email" value="" onChangeText={fn} />));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    expect(fn).toHaveBeenCalledWith("a@b.c");
  });

  it("renders error text when provided", () => {
    render(wrap(<Input label="Email" value="" onChangeText={() => {}} error="Invalid" />));
    expect(screen.getByText("Invalid").textContent).toBe("Invalid");
  });

  it("renders hint when provided and no error", () => {
    render(
      wrap(<Input label="Email" value="" onChangeText={() => {}} hint="we never share this" />),
    );
    expect(screen.getByText("we never share this").textContent).toBe("we never share this");
  });

  it("hides hint when an error is present", () => {
    render(wrap(<Input label="Email" value="" onChangeText={() => {}} hint="ok" error="bad" />));
    expect(screen.queryByText("ok")).toBeNull();
  });
});
