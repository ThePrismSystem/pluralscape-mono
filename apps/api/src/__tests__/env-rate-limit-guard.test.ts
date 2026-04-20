import { beforeEach, describe, expect, it, vi } from "vitest";

import { withEnv, withProdEnv } from "./helpers/env-test-helpers.js";

describe("env DISABLE_RATE_LIMIT production guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("forces DISABLE_RATE_LIMIT to false in production and logs a critical warning", async () => {
    await withProdEnv({ DISABLE_RATE_LIMIT: "1" }, async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const { env } = await import("../env.js");
      expect(env.DISABLE_RATE_LIMIT).toBe(false);
      expect(stderrSpy).toHaveBeenCalledWith(
        "CRITICAL: DISABLE_RATE_LIMIT=1 is not allowed in production. Forcing rate limiting ON.\n",
      );
    });
  });

  it("allows DISABLE_RATE_LIMIT=1 in development", async () => {
    await withEnv("development", { DISABLE_RATE_LIMIT: "1" }, async () => {
      const { env } = await import("../env.js");
      expect(env.DISABLE_RATE_LIMIT).toBe(true);
    });
  });

  it("allows DISABLE_RATE_LIMIT=1 in test", async () => {
    await withEnv("test", { DISABLE_RATE_LIMIT: "1" }, async () => {
      const { env } = await import("../env.js");
      expect(env.DISABLE_RATE_LIMIT).toBe(true);
    });
  });

  it("keeps DISABLE_RATE_LIMIT=0 as false in production", async () => {
    await withProdEnv({ DISABLE_RATE_LIMIT: "0" }, async () => {
      const { env } = await import("../env.js");
      expect(env.DISABLE_RATE_LIMIT).toBe(false);
    });
  });
});
