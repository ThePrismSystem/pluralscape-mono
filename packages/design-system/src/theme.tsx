import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import { themes, type Theme, type ThemeMode } from "./themes.generated";

export { themes, type Theme, type ThemeMode };

interface ThemeContextValue {
  readonly theme: Theme;
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly mode: ThemeMode;
  readonly onModeChange: (mode: ThemeMode) => void;
  readonly children: ReactNode;
}

export function ThemeProvider({
  mode,
  onModeChange,
  children,
}: ThemeProviderProps): React.ReactElement {
  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themes[mode], mode, setMode: onModeChange }),
    [mode, onModeChange],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be called inside <ThemeProvider>");
  }
  return ctx.theme;
}

export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be called inside <ThemeProvider>");
  }
  return { mode: ctx.mode, setMode: ctx.setMode };
}
