/// <reference lib="dom" />
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../../theme";
import { Badge } from "../Badge";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider mode="default" onModeChange={() => {}}>
    {ui}
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("renders children as label", () => {
    render(wrap(<Badge>Fronting</Badge>));
    expect(screen.getByText("Fronting").textContent).toBe("Fronting");
  });

  it.each(["success", "intimate", "warning", "danger", "neutral"] as const)(
    "renders tone=%s without crashing",
    (tone) => {
      render(wrap(<Badge tone={tone}>x</Badge>));
      expect(screen.getByText("x").textContent).toBe("x");
    },
  );
});
