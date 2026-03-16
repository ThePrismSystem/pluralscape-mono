import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { AEAD_KEY_BYTES, AEAD_NONCE_BYTES, AEAD_TAG_BYTES } from "../crypto.constants.js";
import { DecryptionFailedError } from "../errors.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

function fromBytes(b: Uint8Array): string {
  return String.fromCharCode(...b);
}

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("AEAD encrypt/decrypt", () => {
  it("roundtrips plaintext correctly", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("hello, pluralscape");

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
    const decrypted = adapter.aeadDecrypt(ciphertext, nonce, null, key);

    expect(fromBytes(decrypted)).toBe("hello, pluralscape");
  });

  it("roundtrips with additional data", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("secret message");
    const ad = toBytes("context-metadata");

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, ad, key);
    const decrypted = adapter.aeadDecrypt(ciphertext, nonce, ad, key);

    expect(fromBytes(decrypted)).toBe("secret message");
  });

  it("fails when additional data mismatches", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("secret");
    const ad = toBytes("correct-context");
    const wrongAd = toBytes("wrong-context");

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, ad, key);

    expect(() => adapter.aeadDecrypt(ciphertext, nonce, wrongAd, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("detects tampered ciphertext", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("untampered");

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);

    // Flip a byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => adapter.aeadDecrypt(tampered, nonce, null, key)).toThrow(DecryptionFailedError);
  });

  it("fails with wrong key", () => {
    const key = adapter.aeadKeygen();
    const wrongKey = adapter.aeadKeygen();
    const plaintext = toBytes("key-specific");

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);

    expect(() => adapter.aeadDecrypt(ciphertext, nonce, null, wrongKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("produces ciphertext longer than plaintext by tag size", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("measure me");

    const { ciphertext } = adapter.aeadEncrypt(plaintext, null, key);

    expect(ciphertext.length).toBe(plaintext.length + AEAD_TAG_BYTES);
  });

  it("generates a nonce of the correct size", () => {
    const key = adapter.aeadKeygen();
    const { nonce } = adapter.aeadEncrypt(toBytes("x"), null, key);
    expect(nonce.length).toBe(AEAD_NONCE_BYTES);
  });

  it("encrypts and decrypts empty plaintext", () => {
    const key = adapter.aeadKeygen();
    const plaintext = new Uint8Array(0);

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
    const decrypted = adapter.aeadDecrypt(ciphertext, nonce, null, key);

    expect(decrypted.length).toBe(0);
  });

  it("fails with wrong nonce", () => {
    const key = adapter.aeadKeygen();
    const plaintext = toBytes("nonce test");

    const { ciphertext } = adapter.aeadEncrypt(plaintext, null, key);
    // Use the nonce from a different encryption — correctly typed but wrong value
    const { nonce: wrongNonce } = adapter.aeadEncrypt(toBytes("x"), null, key);

    expect(() => adapter.aeadDecrypt(ciphertext, wrongNonce, null, key)).toThrow(
      DecryptionFailedError,
    );
  });
});

describe("aeadKeygen", () => {
  it("generates a key of the correct size", () => {
    const key = adapter.aeadKeygen();
    expect(key.length).toBe(AEAD_KEY_BYTES);
  });

  it("generates unique keys", () => {
    const a = adapter.aeadKeygen();
    const b = adapter.aeadKeygen();
    expect(a).not.toEqual(b);
  });
});
