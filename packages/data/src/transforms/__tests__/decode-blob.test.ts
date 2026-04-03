
import {
  configureSodium,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { decodeAndDecryptT1, encryptAndEncodeT1 } from "../decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

/** Convert Uint8Array to base64 without Buffer (matches runtime in packages/data). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

describe("decodeAndDecryptT1", () => {
  it("decodes base64 and decrypts a T1 blob to plaintext", () => {
    const plaintext = { name: "Alice", pronouns: ["they/them"] };
    const blob = encryptTier1(plaintext, masterKey);
    const base64 = toBase64(serializeEncryptedBlob(blob));

    const result = decodeAndDecryptT1(base64, masterKey);
    expect(result).toEqual(plaintext);
  });

  it("throws on invalid base64", () => {
    expect(() => decodeAndDecryptT1("not-valid-base64!!!", masterKey)).toThrow();
  });

  it("throws on corrupted blob", () => {
    const bytes = new Uint8Array(10).fill(0xff);
    const base64 = toBase64(bytes);
    expect(() => decodeAndDecryptT1(base64, masterKey)).toThrow();
  });
});

describe("encryptAndEncodeT1", () => {
  it("encrypts plaintext and encodes to base64 string", () => {
    const plaintext = { description: "test data" };
    const base64 = encryptAndEncodeT1(plaintext, masterKey);

    expect(typeof base64).toBe("string");
    const result = decodeAndDecryptT1(base64, masterKey);
    expect(result).toEqual(plaintext);
  });
});
