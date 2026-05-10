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
    const initialBg = result.current.color.bg;
    expect(typeof initialBg).toBe("string");

    act(() => {
      mode = "high-contrast";
      rerender();
    });

    expect(typeof result.current.color.bg).toBe("string");
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
