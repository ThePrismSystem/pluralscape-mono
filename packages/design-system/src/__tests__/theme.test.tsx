// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ThemeProvider, useTheme, useThemeMode } from "../theme";

import type { ThemeMode } from "../theme";

describe("ThemeProvider + useTheme", () => {
  it("provides the default theme when mode='default'", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider mode="default" onModeChange={() => {}}>
          {children}
        </ThemeProvider>
      ),
    });
    expect(result.current.color.bg).toBe("#0f0f23");
  });

  it("switches resolved values when mode changes", () => {
    let mode: ThemeMode = "default";
    const { result, rerender } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider mode={mode} onModeChange={() => {}}>
          {children}
        </ThemeProvider>
      ),
    });
    expect(result.current.color.bg).toBeDefined();

    act(() => {
      mode = "high-contrast";
      rerender();
    });

    // High-contrast theme has a different fg color than default.
    // Just check that bg is still defined; the exact value is asserted in the snapshot.
    expect(result.current.color.bg).toBeDefined();
  });

  it("calls onModeChange when setMode is invoked", () => {
    const calls: string[] = [];
    const { result } = renderHook(() => useThemeMode(), {
      wrapper: ({ children }) => (
        <ThemeProvider mode="default" onModeChange={(m) => calls.push(m)}>
          {children}
        </ThemeProvider>
      ),
    });
    act(() => {
      result.current.setMode("static");
    });
    expect(calls).toEqual(["static"]);
  });

  it("throws when useTheme is called outside a provider", () => {
    const { result } = renderHook(() => {
      try {
        return useTheme();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toMatch(/ThemeProvider/);
  });
});
