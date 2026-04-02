import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const MONOREPO_ROOT = resolve(__dirname, "../../../../..");

describe("check-trpc-parity integration", () => {
  it("exits 0 when run against the actual codebase", () => {
    expect(() => {
      execSync("pnpm trpc:parity", {
        cwd: MONOREPO_ROOT,
        timeout: 30_000,
        stdio: "pipe",
      });
    }).not.toThrow();
  });
});
