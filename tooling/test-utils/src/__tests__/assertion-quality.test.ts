import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard — test files must not contain bare `.toBeDefined()`
 * assertions. They provide weak coverage (any non-undefined value passes)
 * and historically hide missing real assertions.
 *
 * Replace with a specific value check, a type-narrowing shape check, or
 * delete the assertion outright.
 */
const FORBIDDEN_PATTERN = "\\.toBeDefined\\(\\)";
const PATHSPEC = [
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  ":!tooling/test-utils/src/__tests__/assertion-quality.test.ts",
];

/**
 * Run `git grep -nE <pattern> -- <pathspec...>` and return the stdout.
 *
 * git grep exit codes:
 *   0 — matches found (stdout non-empty)
 *   1 — no matches (stdout empty) — the passing case
 *   other — tooling error (bad pathspec, not a git tree, etc.)
 *
 * We intentionally do NOT mask failure with `|| true` — a tooling error
 * returning exit 0 would make this test a silent false negative.
 */
function runGitGrep(pattern: string, pathspec: string[]): string {
  const result = spawnSync("git", ["grep", "-nE", pattern, "--", ...pathspec], {
    encoding: "utf8",
    cwd: process.cwd(),
  });

  if (result.status === 0) return result.stdout;
  if (result.status === 1) return "";
  throw new Error(
    `assertion-quality guard: git grep exited with status ${String(result.status)}. ` +
      `stderr: ${result.stderr.trim() || "(empty)"}`,
  );
}

describe("assertion quality guard", () => {
  it("has no bare toBeDefined() assertions in test files", () => {
    const output = runGitGrep(FORBIDDEN_PATTERN, PATHSPEC);
    expect(output.trim()).toBe("");
  });
});

describe("assertion quality guard — negative test", () => {
  it("reports a match when a test file contains bare toBeDefined()", () => {
    // Create a tmp directory OUTSIDE the git tree so `git grep` scoped to
    // an absolute path still exercises the rg pattern match but without
    // polluting the repo. Use `grep` directly (not git grep) against the
    // same pattern to prove the detection pattern itself works.
    const dir = mkdtempSync(join(tmpdir(), "assertion-quality-"));
    const file = join(dir, "sample.test.ts");
    writeFileSync(file, "expect(value).toBeDefined();\n");
    try {
      const result = spawnSync("grep", ["-nE", FORBIDDEN_PATTERN, file], {
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(".toBeDefined()");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
