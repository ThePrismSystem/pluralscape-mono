import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * Regression guard — mobile test files must not contain bare
 * `.toBeDefined()` assertions. They provide weak coverage (any non-undefined
 * value passes) and historically hide missing real assertions.
 *
 * Replace with a specific value check, a type-narrowing shape check, or
 * delete the assertion outright. See MOBILE-TC-L1 / mobile-otb3 for the
 * full triage rationale.
 */
describe("mobile assertion quality guard", () => {
  it("has no bare toBeDefined() assertions in test files", () => {
    const output = execSync(
      "git grep -nE '\\.toBeDefined\\(\\)' -- " +
        "'apps/mobile/**/*.test.ts' 'apps/mobile/**/*.test.tsx' " +
        "':!apps/mobile/src/__tests__/assertion-quality.test.ts' || true",
      { encoding: "utf8", cwd: process.cwd() },
    );
    expect(output.trim()).toBe("");
  });
});
