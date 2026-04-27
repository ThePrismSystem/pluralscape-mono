import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { PUBLIC_KEY_BYTE_LENGTH } from "@pluralscape/validation";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { decryptApiKeyPayload, encryptApiKeyPayload } from "../api-key.js";
import { encryptAndEncodeT1 } from "../decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ApiKeyEncryptedPayload } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

describe("ApiKey payload transforms", () => {
  it("round-trips a metadata variant", () => {
    const original: ApiKeyEncryptedPayload = { keyType: "metadata", name: "ci-bot" };
    const { encryptedData } = encryptApiKeyPayload(original, masterKey);
    const decoded = decryptApiKeyPayload(encryptedData, masterKey);
    expect(decoded).toEqual(original);
  });

  it("round-trips a crypto variant preserving Uint8Array publicKey", () => {
    const publicKey = new Uint8Array(PUBLIC_KEY_BYTE_LENGTH);
    for (let i = 0; i < publicKey.length; i++) publicKey[i] = (i * 11 + 5) & 0xff;
    const original: ApiKeyEncryptedPayload = {
      keyType: "crypto",
      name: "session-key",
      publicKey,
    };
    const { encryptedData } = encryptApiKeyPayload(original, masterKey);
    const decoded = decryptApiKeyPayload(encryptedData, masterKey);
    if (decoded.keyType !== "crypto") throw new Error("expected crypto variant");
    expect(decoded.name).toBe("session-key");
    expect(decoded.publicKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded.publicKey)).toEqual(Array.from(publicKey));
  });

  it("rejects a malformed plaintext (wrong shape)", () => {
    // Use the underlying T1 helper directly to produce ciphertext whose
    // plaintext does not match the codec's wire schema; decryptApiKeyPayload
    // must throw because z.parse rejects the wire-side parse.
    const malformed = encryptAndEncodeT1({ keyType: "rogue" }, masterKey);
    expect(() => decryptApiKeyPayload(malformed, masterKey)).toThrow();
  });

  it("rejects a malformed plaintext (publicKey wrong byte length)", () => {
    // Encrypt a wire-shape payload whose publicKey decodes to fewer than 32
    // bytes; the codec's memory-side .refine must reject after decode.
    const wireShape = {
      keyType: "crypto",
      name: "short",
      publicKey: z.util.uint8ArrayToBase64(new Uint8Array(PUBLIC_KEY_BYTE_LENGTH - 1)),
    };
    const malformed = encryptAndEncodeT1(wireShape, masterKey);
    expect(() => decryptApiKeyPayload(malformed, masterKey)).toThrow();
  });
});
