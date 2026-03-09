import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { AEAD_NONCE_BYTES } from "../constants.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { _resetForTesting, configureSodium, initSodium, getSodium } from "../sodium.js";
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  encryptStream,
  decryptStream,
} from "../symmetric.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { EncryptedPayload } from "../symmetric.js";
import type { AeadKey } from "../types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let key: AeadKey;
let adapter: SodiumAdapter;

beforeAll(async () => {
  _resetForTesting();
  adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
  key = getSodium().aeadKeygen();
});

afterAll(() => {
  _resetForTesting();
});

describe("encrypt/decrypt", () => {
  it("roundtrips plaintext correctly", () => {
    const plaintext = encoder.encode("hello, pluralscape");
    const payload = encrypt(plaintext, key);
    const decrypted = decrypt(payload, key);
    expect(decoder.decode(decrypted)).toBe("hello, pluralscape");
  });

  it("generates a random 24-byte nonce per encryption", () => {
    const plaintext = encoder.encode("nonce test");
    const p1 = encrypt(plaintext, key);
    const p2 = encrypt(plaintext, key);
    expect(p1.nonce.length).toBe(AEAD_NONCE_BYTES);
    expect(p2.nonce.length).toBe(AEAD_NONCE_BYTES);
    expect(p1.nonce).not.toEqual(p2.nonce);
  });

  it("produces different ciphertexts for same data (random nonce)", () => {
    const plaintext = encoder.encode("same data");
    const p1 = encrypt(plaintext, key);
    const p2 = encrypt(plaintext, key);
    expect(p1.ciphertext).not.toEqual(p2.ciphertext);
  });

  it("roundtrips with AAD", () => {
    const plaintext = encoder.encode("aad test");
    const aad = encoder.encode("context-metadata");
    const payload = encrypt(plaintext, key, aad);
    const decrypted = decrypt(payload, key, aad);
    expect(decoder.decode(decrypted)).toBe("aad test");
  });

  it("fails when AAD mismatches", () => {
    const plaintext = encoder.encode("aad mismatch");
    const aad = encoder.encode("correct");
    const wrongAad = encoder.encode("wrong");
    const payload = encrypt(plaintext, key, aad);
    expect(() => decrypt(payload, key, wrongAad)).toThrow(DecryptionFailedError);
  });

  it("detects tampered ciphertext", () => {
    const plaintext = encoder.encode("tamper test");
    const payload = encrypt(plaintext, key);
    const tampered = new Uint8Array(payload.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => decrypt({ ciphertext: tampered, nonce: payload.nonce }, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("fails with wrong key", () => {
    const wrongKey = getSodium().aeadKeygen();
    const plaintext = encoder.encode("wrong key");
    const payload = encrypt(plaintext, key);
    expect(() => decrypt(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("roundtrips empty plaintext", () => {
    const plaintext = new Uint8Array(0);
    const payload = encrypt(plaintext, key);
    const decrypted = decrypt(payload, key);
    expect(decrypted.length).toBe(0);
  });
});

describe("encryptJSON/decryptJSON", () => {
  it("roundtrips a JSON object", () => {
    const data = { name: "test", count: 42 };
    const payload = encryptJSON(data, key);
    const result = decryptJSON(payload, key);
    expect(result).toEqual(data);
  });

  it("roundtrips nested data types", () => {
    const data = {
      members: [{ name: "Alice" }, { name: "Bob" }],
      meta: { nested: { deep: true } },
      count: 0,
      active: false,
      tags: ["a", "b"],
    };
    const payload = encryptJSON(data, key);
    const result = decryptJSON(payload, key);
    expect(result).toEqual(data);
  });

  it("wrong key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const payload = encryptJSON({ data: true }, key);
    expect(() => decryptJSON(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("non-JSON plaintext throws DecryptionFailedError with SyntaxError cause", () => {
    // Encrypt raw non-JSON text, then try to decrypt as JSON
    const notJson = encoder.encode("this is not json");
    const payload = encrypt(notJson, key);
    const error = (() => {
      try {
        decryptJSON(payload, key);
        return null;
      } catch (e: unknown) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(DecryptionFailedError);
    expect((error as DecryptionFailedError).cause).toBeInstanceOf(SyntaxError);
  });
});

describe("encryptStream/decryptStream", () => {
  it("roundtrips data larger than chunk size", () => {
    const chunkSize = 64;
    // 3.5 chunks worth of data
    const plaintext = new Uint8Array(chunkSize * 3 + chunkSize / 2);
    plaintext.set(adapter.randomBytes(plaintext.length));

    const payload = encryptStream(plaintext, key, chunkSize);
    const decrypted = decryptStream(payload, key);

    expect(decrypted).toEqual(plaintext);
  });

  it("roundtrips data smaller than one chunk", () => {
    const plaintext = encoder.encode("small");
    const payload = encryptStream(plaintext, key, 65536);
    expect(payload.chunks.length).toBe(1);
    const decrypted = decryptStream(payload, key);
    expect(decoder.decode(decrypted)).toBe("small");
  });

  it("chunk count matches expected", () => {
    const chunkSize = 100;
    const plaintext = new Uint8Array(350);
    const payload = encryptStream(plaintext, key, chunkSize);
    // 350 / 100 = 4 chunks (100, 100, 100, 50)
    expect(payload.chunks.length).toBe(4);
    expect(payload.totalLength).toBe(350);
  });

  it("reordered chunks fail decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(150));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Swap first two chunks
    const reordered = [
      payload.chunks[1],
      payload.chunks[0],
      ...payload.chunks.slice(2),
    ] as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: reordered, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("truncated (missing chunk) fails decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Remove last chunk
    const truncated = payload.chunks.slice(0, -1);

    expect(() =>
      decryptStream({ chunks: truncated, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("tampered single chunk fails decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Tamper with the second chunk's ciphertext
    const tamperedChunks = payload.chunks.map((c: EncryptedPayload, i: number) => {
      if (i === 1) {
        const tampered = new Uint8Array(c.ciphertext);
        tampered[0] = (tampered[0] ?? 0) ^ 0xff;
        return { ciphertext: tampered, nonce: c.nonce };
      }
      return c;
    }) as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: tamperedChunks, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("wrong key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const plaintext = encoder.encode("stream wrong key");
    const payload = encryptStream(plaintext, key, 64);
    expect(() => decryptStream(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered totalLength throws DecryptionFailedError", () => {
    const plaintext = encoder.encode("length check");
    const payload = encryptStream(plaintext, key, 64);
    // Tamper with totalLength — chunks decrypt fine but length won't match
    expect(() =>
      decryptStream({ chunks: payload.chunks, totalLength: payload.totalLength + 1 }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("chunkSize = 0 throws InvalidInputError", () => {
    const plaintext = encoder.encode("zero chunk");
    expect(() => encryptStream(plaintext, key, 0)).toThrow(InvalidInputError);
  });

  it("negative chunkSize throws InvalidInputError", () => {
    const plaintext = encoder.encode("negative chunk");
    expect(() => encryptStream(plaintext, key, -1)).toThrow(InvalidInputError);
  });

  it("roundtrips empty input", () => {
    const plaintext = new Uint8Array(0);
    const payload = encryptStream(plaintext, key, 64);
    const decrypted = decryptStream(payload, key);
    expect(decrypted.length).toBe(0);
  });

  it("duplicated chunks fail decryption (AAD mismatch)", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Replace last chunk with a duplicate of the first — AAD chunk count changes
    const duplicated = [
      ...payload.chunks.slice(0, 2),
      payload.chunks[0],
    ] as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: duplicated, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });
});
