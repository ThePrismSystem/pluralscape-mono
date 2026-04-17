/// <reference types="bun" />
import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("brandId cast guard", () => {
  it("has no 'as XxxId' casts in test files or fixtures", () => {
    // Matches `as XxxId` NOT followed by `|` or `&` (those are union/
    // intersection casts — intentional widening, not a plain branded-ID cast
    // that brandId() can replace).
    const output = execSync(
      "git grep -nE ' as [A-Z][a-zA-Z]*Id\\b[[:space:]]*([^|&[:space:]]|$)' -- " +
        "'apps/**/*.test.ts' 'apps/**/*.test.tsx' " +
        "'apps/**/__tests__/**/*.ts' 'apps/**/__tests__/**/*.tsx' " +
        "'packages/**/*.test.ts' 'packages/**/__tests__/**/*.ts' " +
        "'apps/api-e2e/src/fixtures/**/*.ts' || true",
      { encoding: "utf8", cwd: process.cwd() },
    );
    expect(output.trim()).toBe("");
  });
});
