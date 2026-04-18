import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env DISABLE_RATE_LIMIT production guard", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  const originalDisableRateLimit = process.env["DISABLE_RATE_LIMIT"];
  const originalEmailHashPepper = process.env["EMAIL_HASH_PEPPER"];
  const originalEmailEncryptionKey = process.env["EMAIL_ENCRYPTION_KEY"];
  const originalWebhookPayloadEncryptionKey = process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"];
  const originalApiKeyHmacKey = process.env["API_KEY_HMAC_KEY"];
  const originalCrowdinDistributionHash = process.env["CROWDIN_DISTRIBUTION_HASH"];

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
    if (originalWebhookPayloadEncryptionKey === undefined) {
      delete process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"];
    } else {
      process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"] = originalWebhookPayloadEncryptionKey;
    }
    if (originalApiKeyHmacKey === undefined) {
      delete process.env["API_KEY_HMAC_KEY"];
    } else {
      process.env["API_KEY_HMAC_KEY"] = originalApiKeyHmacKey;
    }
    if (originalCrowdinDistributionHash === undefined) {
      delete process.env["CROWDIN_DISTRIBUTION_HASH"];
    } else {
      process.env["CROWDIN_DISTRIBUTION_HASH"] = originalCrowdinDistributionHash;
    }
  });

  it("forces DISABLE_RATE_LIMIT to false in production and logs a critical warning", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["DISABLE_RATE_LIMIT"] = "1";
    // Production-required env vars
    process.env["EMAIL_HASH_PEPPER"] = "a".repeat(64);
    process.env["EMAIL_ENCRYPTION_KEY"] = "b".repeat(64);
    process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"] = "c".repeat(64);
    process.env["API_KEY_HMAC_KEY"] = "d".repeat(64);
    process.env["CROWDIN_DISTRIBUTION_HASH"] = "test-hash";

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
    process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"] = "c".repeat(64);
    process.env["API_KEY_HMAC_KEY"] = "d".repeat(64);
    process.env["CROWDIN_DISTRIBUTION_HASH"] = "test-hash";

    const { env } = await import("../env.js");

    expect(env.DISABLE_RATE_LIMIT).toBe(false);
  });
});
