import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const MONOREPO_ROOT = resolve(__dirname, "../../../../..");
/** The script takes seconds alone, but this suite runs it beside every other integration test. */
const PARITY_SCRIPT_TIMEOUT_MS = 120_000;

describe("check-trpc-parity integration", () => {
  it(
    "exits 0 when run against the actual codebase",
    () => {
      expect(() => {
        execSync("pnpm trpc:parity", {
          cwd: MONOREPO_ROOT,
          timeout: PARITY_SCRIPT_TIMEOUT_MS,
          stdio: "pipe",
        });
      }).not.toThrow();
    },
    PARITY_SCRIPT_TIMEOUT_MS,
  );
});
