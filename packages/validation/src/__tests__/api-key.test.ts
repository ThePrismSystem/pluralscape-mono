import { describe, expect, it } from "vitest";

import { ApiKeyEncryptedPayloadSchema } from "../api-key.js";
import { PUBLIC_KEY_BYTE_LENGTH } from "../validation.constants.js";

describe("ApiKeyEncryptedPayloadSchema", () => {
  it("accepts a valid metadata-key payload", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "metadata",
      name: "ci-bot",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid crypto-key payload (32-byte publicKey)", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "session-key",
      publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown keyType discriminator", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "signing",
      name: "rogue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a crypto payload missing publicKey", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "missing-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name on metadata variant", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "metadata",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name on crypto variant", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "",
      publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a publicKey shorter than 32 bytes", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "short-key",
      publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH - 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a publicKey longer than 32 bytes", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "long-key",
      publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a base64 string for publicKey (in-memory contract)", () => {
    const result = ApiKeyEncryptedPayloadSchema.safeParse({
      keyType: "crypto",
      name: "string-key",
      publicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    });
    expect(result.success).toBe(false);
  });
});
