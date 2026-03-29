import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env DISABLE_RATE_LIMIT production guard", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  const originalDisableRateLimit = process.env["DISABLE_RATE_LIMIT"];
  const originalEmailHashPepper = process.env["EMAIL_HASH_PEPPER"];
  const originalEmailEncryptionKey = process.env["EMAIL_ENCRYPTION_KEY"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Restore original env vars
    if (originalNodeEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalNodeEnv;
    }
    if (originalDisableRateLimit === undefined) {
      delete process.env["DISABLE_RATE_LIMIT"];
    } else {
      process.env["DISABLE_RATE_LIMIT"] = originalDisableRateLimit;
    }
    if (originalEmailHashPepper === undefined) {
      delete process.env["EMAIL_HASH_PEPPER"];
    } else {
      process.env["EMAIL_HASH_PEPPER"] = originalEmailHashPepper;
    }
    if (originalEmailEncryptionKey === undefined) {
      delete process.env["EMAIL_ENCRYPTION_KEY"];
    } else {
      process.env["EMAIL_ENCRYPTION_KEY"] = originalEmailEncryptionKey;
    }
  });

  it("forces DISABLE_RATE_LIMIT to false in production and logs a critical warning", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["DISABLE_RATE_LIMIT"] = "1";
    // EMAIL_HASH_PEPPER and EMAIL_ENCRYPTION_KEY are required in production
    process.env["EMAIL_HASH_PEPPER"] = "a".repeat(64);
    process.env["EMAIL_ENCRYPTION_KEY"] = "b".repeat(64);

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { env } = await import("../env.js");

    expect(env.DISABLE_RATE_LIMIT).toBe(false);
    expect(stderrSpy).toHaveBeenCalledWith(
      "CRITICAL: DISABLE_RATE_LIMIT=1 is not allowed in production. Forcing rate limiting ON.\n",
    );
  });

  it("allows DISABLE_RATE_LIMIT=1 in development", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["DISABLE_RATE_LIMIT"] = "1";

    const { env } = await import("../env.js");

    expect(env.DISABLE_RATE_LIMIT).toBe(true);
  });

  it("allows DISABLE_RATE_LIMIT=1 in test", async () => {
    process.env["NODE_ENV"] = "test";
    process.env["DISABLE_RATE_LIMIT"] = "1";

    const { env } = await import("../env.js");

    expect(env.DISABLE_RATE_LIMIT).toBe(true);
  });

  it("keeps DISABLE_RATE_LIMIT=0 as false in production", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["DISABLE_RATE_LIMIT"] = "0";
    process.env["EMAIL_HASH_PEPPER"] = "a".repeat(64);
    process.env["EMAIL_ENCRYPTION_KEY"] = "b".repeat(64);

    const { env } = await import("../env.js");

    expect(env.DISABLE_RATE_LIMIT).toBe(false);
  });
});
