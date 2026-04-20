import { beforeEach, describe, expect, it, vi } from "vitest";

import { withEnv, withProdEnv } from "./helpers/env-test-helpers.js";

/**
 * env.ts validates ANTI_ENUM_SALT_SECRET via Zod. These tests assert:
 *   - production without the secret fails boot
 *   - production with the dev default fails boot
 *   - production with a secret shorter than 32 chars fails boot
 *   - production with a valid override succeeds
 *   - development without the secret succeeds (optional fallback)
 *
 * `vi.resetModules` is required before each test because `env.ts` caches
 * the parsed schema at module-load time.
 */
describe("env ANTI_ENUM_SALT_SECRET validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects production when ANTI_ENUM_SALT_SECRET is unset", async () => {
    await withProdEnv({ ANTI_ENUM_SALT_SECRET: undefined }, async () => {
      // @t3-oss/env-core wraps Zod errors with a generic "Invalid environment
      // variables" message and logs the specific refinement to stderr. We
      // capture stderr and assert the ANTI_ENUM_SALT_SECRET field is cited.
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
      const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
      expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
    });
  });

  it("rejects production when ANTI_ENUM_SALT_SECRET equals the development default", async () => {
    await withProdEnv(
      { ANTI_ENUM_SALT_SECRET: "pluralscape-dev-anti-enum-secret-do-not-use-in-prod" },
      async () => {
        const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
        const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
        expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
      },
    );
  });

  it("rejects production when ANTI_ENUM_SALT_SECRET is shorter than 32 chars", async () => {
    await withProdEnv({ ANTI_ENUM_SALT_SECRET: "too-short" }, async () => {
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
      const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
      expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
    });
  });

  it("accepts production with a 32+ char ANTI_ENUM_SALT_SECRET", async () => {
    // 36 chars of entropy — exceeds the 32-char minimum and is not the dev default.
    await withProdEnv({ ANTI_ENUM_SALT_SECRET: "z".repeat(36) }, async () => {
      const { env } = await import("../env.js");
      expect(env.ANTI_ENUM_SALT_SECRET).toBe("z".repeat(36));
    });
  });

  it("allows development without ANTI_ENUM_SALT_SECRET (optional fallback)", async () => {
    await withEnv("development", { ANTI_ENUM_SALT_SECRET: undefined }, async () => {
      const { env } = await import("../env.js");
      expect(env.ANTI_ENUM_SALT_SECRET).toBeUndefined();
    });
  });
});
