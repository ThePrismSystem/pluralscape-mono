import { afterEach, describe, expect, it } from "vitest";

import { inheritEnvWithoutVitest } from "../e2e/api-env.js";

describe("inheritEnvWithoutVitest", () => {
  const originalVitest = process.env["VITEST"];
  afterEach(() => {
    if (originalVitest === undefined) {
      delete process.env["VITEST"];
    } else {
      process.env["VITEST"] = originalVitest;
    }
  });

  it("returns a copy of process.env without the VITEST key", () => {
    process.env["VITEST"] = "true";
    const result = inheritEnvWithoutVitest();
    expect("VITEST" in result).toBe(false);
    expect(result["VITEST"]).toBeUndefined();
  });

  it("preserves other env vars", () => {
    process.env["VITEST"] = "true";
    process.env["PLURALSCAPE_TEST_MARKER_ABC"] = "keep-me";
    try {
      const result = inheritEnvWithoutVitest();
      expect(result["PLURALSCAPE_TEST_MARKER_ABC"]).toBe("keep-me");
      expect(result["PATH"]).toBe(process.env["PATH"]);
    } finally {
      delete process.env["PLURALSCAPE_TEST_MARKER_ABC"];
    }
  });

  it("does not mutate process.env when caller mutates result", () => {
    process.env["VITEST"] = "true";
    const result = inheritEnvWithoutVitest();
    result["NEW_KEY_FROM_RESULT"] = "x";
    expect(process.env["NEW_KEY_FROM_RESULT"]).toBeUndefined();
    expect(process.env["VITEST"]).toBe("true");
  });

  it("returns a fresh object each call", () => {
    const a = inheritEnvWithoutVitest();
    const b = inheritEnvWithoutVitest();
    expect(a).not.toBe(b);
  });

  it("regression: strips VITEST even when explicitly set on parent", () => {
    // The spawned API server gates start() on !process.env.VITEST.
    // If the parent leaks it, the server never starts and the health
    // check times out. Guard the fix here so the behavior can't silently
    // regress.
    process.env["VITEST"] = "1";
    const result = inheritEnvWithoutVitest();
    expect(result["VITEST"]).toBeUndefined();
    expect("VITEST" in result).toBe(false);
  });

  it("works when VITEST is absent on the parent", () => {
    delete process.env["VITEST"];
    const result = inheritEnvWithoutVitest();
    expect(result["VITEST"]).toBeUndefined();
  });
});
