import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  const originalNodeEnv = process.env["NODE_ENV"];
  const originalAntiEnumSaltSecret = process.env["ANTI_ENUM_SALT_SECRET"];
  const originalEmailHashPepper = process.env["EMAIL_HASH_PEPPER"];
  const originalEmailEncryptionKey = process.env["EMAIL_ENCRYPTION_KEY"];
  const originalWebhookPayloadEncryptionKey = process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"];
  const originalApiKeyHmacKey = process.env["API_KEY_HMAC_KEY"];
  const originalCrowdinDistributionHash = process.env["CROWDIN_DISTRIBUTION_HASH"];

  /** Populate the other production-required env vars with dummy-but-valid values. */
  function setOtherProdRequiredEnv(): void {
    process.env["EMAIL_HASH_PEPPER"] = "a".repeat(64);
    process.env["EMAIL_ENCRYPTION_KEY"] = "b".repeat(64);
    process.env["WEBHOOK_PAYLOAD_ENCRYPTION_KEY"] = "c".repeat(64);
    process.env["API_KEY_HMAC_KEY"] = "d".repeat(64);
    process.env["CROWDIN_DISTRIBUTION_HASH"] = "test-hash";
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalNodeEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalNodeEnv;
    }
    if (originalAntiEnumSaltSecret === undefined) {
      delete process.env["ANTI_ENUM_SALT_SECRET"];
    } else {
      process.env["ANTI_ENUM_SALT_SECRET"] = originalAntiEnumSaltSecret;
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

  it("rejects production when ANTI_ENUM_SALT_SECRET is unset", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["ANTI_ENUM_SALT_SECRET"];
    setOtherProdRequiredEnv();

    // @t3-oss/env-core wraps Zod errors with a generic "Invalid environment
    // variables" message and logs the specific refinement to stderr. We
    // capture stderr and assert the ANTI_ENUM_SALT_SECRET field is cited.
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
    const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
    expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
  });

  it("rejects production when ANTI_ENUM_SALT_SECRET equals the development default", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ANTI_ENUM_SALT_SECRET"] = "pluralscape-dev-anti-enum-secret-do-not-use-in-prod";
    setOtherProdRequiredEnv();

    // @t3-oss/env-core wraps Zod errors with a generic "Invalid environment
    // variables" message and logs the specific refinement to stderr. We
    // capture stderr and assert the ANTI_ENUM_SALT_SECRET field is cited.
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
    const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
    expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
  });

  it("rejects production when ANTI_ENUM_SALT_SECRET is shorter than 32 chars", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ANTI_ENUM_SALT_SECRET"] = "too-short";
    setOtherProdRequiredEnv();

    // @t3-oss/env-core wraps Zod errors with a generic "Invalid environment
    // variables" message and logs the specific refinement to stderr. We
    // capture stderr and assert the ANTI_ENUM_SALT_SECRET field is cited.
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(import("../env.js")).rejects.toThrow(/Invalid environment variables/);
    const stderrText = stderrSpy.mock.calls.map((args) => JSON.stringify(args)).join("\n");
    expect(stderrText).toMatch(/ANTI_ENUM_SALT_SECRET/);
  });

  it("accepts production with a 32+ char ANTI_ENUM_SALT_SECRET", async () => {
    process.env["NODE_ENV"] = "production";
    // 36 chars of entropy — exceeds the 32-char minimum and is not the dev default.
    process.env["ANTI_ENUM_SALT_SECRET"] = "z".repeat(36);
    setOtherProdRequiredEnv();

    const { env } = await import("../env.js");

    expect(env.ANTI_ENUM_SALT_SECRET).toBe("z".repeat(36));
  });

  it("allows development without ANTI_ENUM_SALT_SECRET (optional fallback)", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["ANTI_ENUM_SALT_SECRET"];

    const { env } = await import("../env.js");

    expect(env.ANTI_ENUM_SALT_SECRET).toBeUndefined();
  });
});
