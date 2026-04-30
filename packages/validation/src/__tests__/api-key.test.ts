import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { ApiKeyEncryptedPayloadSchema, CreateApiKeyBodySchema } from "../api-key.js";
import { PUBLIC_KEY_BYTE_LENGTH } from "../validation.constants.js";

const VALID_PUBLIC_KEY_B64 = z.util.uint8ArrayToBase64(new Uint8Array(PUBLIC_KEY_BYTE_LENGTH));
const VALID_ENCRYPTED_DATA = z.util.uint8ArrayToBase64(new Uint8Array(64));

describe("ApiKeyEncryptedPayloadSchema (codec)", () => {
  describe("z.decode (wire → memory)", () => {
    it("decodes a metadata variant unchanged", () => {
      const result = z.decode(ApiKeyEncryptedPayloadSchema, {
        keyType: "metadata",
        name: "ci-bot",
      });
      expect(result).toEqual({ keyType: "metadata", name: "ci-bot" });
    });

    it("decodes a crypto variant with publicKey base64 → Uint8Array", () => {
      const result = z.decode(ApiKeyEncryptedPayloadSchema, {
        keyType: "crypto",
        name: "session-key",
        publicKey: VALID_PUBLIC_KEY_B64,
      });
      expect(result.keyType).toBe("crypto");
      if (result.keyType === "crypto") {
        expect(result.publicKey).toBeInstanceOf(Uint8Array);
        expect(result.publicKey.length).toBe(PUBLIC_KEY_BYTE_LENGTH);
      }
    });

    it("rejects a publicKey that decodes to wrong byte length", () => {
      const wrongLengthB64 = z.util.uint8ArrayToBase64(new Uint8Array(PUBLIC_KEY_BYTE_LENGTH - 1));
      const result = z.safeParse(ApiKeyEncryptedPayloadSchema, {
        keyType: "crypto",
        name: "short-key",
        publicKey: wrongLengthB64,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an unknown keyType discriminator", () => {
      const result = z.safeParse(ApiKeyEncryptedPayloadSchema, {
        keyType: "signing",
        name: "rogue",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name on metadata variant", () => {
      const result = z.safeParse(ApiKeyEncryptedPayloadSchema, {
        keyType: "metadata",
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name on crypto variant", () => {
      const result = z.safeParse(ApiKeyEncryptedPayloadSchema, {
        keyType: "crypto",
        name: "",
        publicKey: VALID_PUBLIC_KEY_B64,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-base64 publicKey", () => {
      const result = z.safeParse(ApiKeyEncryptedPayloadSchema, {
        keyType: "crypto",
        name: "bad-b64",
        publicKey: "not-base64!!!",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("z.encode (memory → wire)", () => {
    it("encodes a metadata variant unchanged", () => {
      const result = z.encode(ApiKeyEncryptedPayloadSchema, {
        keyType: "metadata",
        name: "ci-bot",
      });
      expect(result).toEqual({ keyType: "metadata", name: "ci-bot" });
    });

    it("encodes a crypto variant with publicKey Uint8Array → base64", () => {
      const result = z.encode(ApiKeyEncryptedPayloadSchema, {
        keyType: "crypto",
        name: "session-key",
        publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH),
      });
      expect(result.keyType).toBe("crypto");
      if (result.keyType === "crypto") {
        expect(typeof result.publicKey).toBe("string");
        expect(z.util.base64ToUint8Array(result.publicKey).length).toBe(PUBLIC_KEY_BYTE_LENGTH);
      }
    });
  });

  it("round-trips a crypto payload through encode → decode", () => {
    const original = {
      keyType: "crypto" as const,
      name: "round-trip",
      publicKey: new Uint8Array(PUBLIC_KEY_BYTE_LENGTH).fill(0x42),
    };
    const wire = z.encode(ApiKeyEncryptedPayloadSchema, original);
    const decoded = z.decode(ApiKeyEncryptedPayloadSchema, wire);
    if (decoded.keyType !== "crypto") throw new Error("expected crypto variant");
    expect(Array.from(decoded.publicKey)).toEqual(Array.from(original.publicKey));
    expect(decoded.name).toBe(original.name);
  });
});

describe("CreateApiKeyBodySchema", () => {
  const validMetadataBody = {
    keyType: "metadata" as const,
    scopes: ["read:fronting"] as const,
    encryptedData: VALID_ENCRYPTED_DATA,
  };

  const validCryptoBody = {
    keyType: "crypto" as const,
    scopes: ["read:fronting"] as const,
    encryptedData: VALID_ENCRYPTED_DATA,
    encryptedKeyMaterial: VALID_ENCRYPTED_DATA,
  };

  it("accepts a valid metadata key", () => {
    expect(CreateApiKeyBodySchema.safeParse(validMetadataBody).success).toBe(true);
  });

  it("accepts a valid crypto key with encryptedKeyMaterial", () => {
    expect(CreateApiKeyBodySchema.safeParse(validCryptoBody).success).toBe(true);
  });

  it("rejects empty scopes array", () => {
    const result = CreateApiKeyBodySchema.safeParse({ ...validMetadataBody, scopes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects keyType=crypto without encryptedKeyMaterial", () => {
    const { encryptedKeyMaterial: _omitted, ...withoutKeyMaterial } = validCryptoBody;
    void _omitted;
    const result = CreateApiKeyBodySchema.safeParse(withoutKeyMaterial);
    expect(result.success).toBe(false);
  });

  it("rejects keyType=metadata WITH encryptedKeyMaterial", () => {
    const result = CreateApiKeyBodySchema.safeParse({
      ...validMetadataBody,
      encryptedKeyMaterial: VALID_ENCRYPTED_DATA,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown scope", () => {
    const result = CreateApiKeyBodySchema.safeParse({
      ...validMetadataBody,
      scopes: ["read:nonsense"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateApiKeyBodySchema.safeParse({ ...validMetadataBody, encryptedData: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional expiresAt as positive integer", () => {
    const result = CreateApiKeyBodySchema.safeParse({
      ...validMetadataBody,
      expiresAt: Date.now() + 86_400_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive expiresAt", () => {
    const result = CreateApiKeyBodySchema.safeParse({ ...validMetadataBody, expiresAt: 0 });
    expect(result.success).toBe(false);
  });
});
