import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  decryptBucketKey,
  encryptBucketKey,
  generateBucketKey,
  rotateBucketKey,
} from "../bucket-keys.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { generateMasterKey } from "../master-key-wrap.js";
import { getSodium } from "../sodium.js";
import { encrypt } from "../symmetric.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { AeadKey, KdfMasterKey } from "../types.js";

let masterKey: KdfMasterKey;
let masterKey2: KdfMasterKey;

beforeAll(async () => {
  await setupSodium();
  masterKey = generateMasterKey();
  masterKey2 = generateMasterKey();
});

afterAll(teardownSodium);

describe("generateBucketKey", () => {
  it("returns a 32-byte AeadKey", () => {
    const key = generateBucketKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("two calls produce different keys", () => {
    const key1 = generateBucketKey();
    const key2 = generateBucketKey();
    expect(key1).not.toEqual(key2);
  });
});

describe("encryptBucketKey / decryptBucketKey", () => {
  let bucketKey: AeadKey;

  beforeAll(() => {
    bucketKey = generateBucketKey();
  });

  it("roundtrips: decrypt returns original key bytes", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const recovered = decryptBucketKey(wrapped, masterKey);
    expect(recovered).toEqual(bucketKey);
  });

  it("WrappedBucketKey preserves keyVersion", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 7);
    expect(wrapped.keyVersion).toBe(7);
  });

  it("keyVersion 0 throws InvalidInputError", () => {
    expect(() => encryptBucketKey(bucketKey, masterKey, 0)).toThrow(InvalidInputError);
  });

  it("negative keyVersion throws InvalidInputError", () => {
    expect(() => encryptBucketKey(bucketKey, masterKey, -1)).toThrow(InvalidInputError);
  });

  it("fractional keyVersion throws InvalidInputError", () => {
    expect(() => encryptBucketKey(bucketKey, masterKey, 1.5)).toThrow(InvalidInputError);
  });

  it("wrong master key throws DecryptionFailedError", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    expect(() => decryptBucketKey(wrapped, masterKey2)).toThrow(DecryptionFailedError);
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const tampered = new Uint8Array(wrapped.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => decryptBucketKey({ ...wrapped, ciphertext: tampered }, masterKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("encryptBucketKey memzeros wrapping key", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    encryptBucketKey(bucketKey, masterKey, 1);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("decryptBucketKey memzeros wrapping key on success", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    decryptBucketKey(wrapped, masterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("decryptBucketKey memzeros wrapping key on error", () => {
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    expect(() => decryptBucketKey(wrapped, masterKey2)).toThrow(DecryptionFailedError);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });
});

describe("rotateBucketKey", () => {
  let oldKey: AeadKey;

  beforeAll(() => {
    oldKey = generateBucketKey();
  });

  it("newKey differs from oldKey", () => {
    const { newKey } = rotateBucketKey(oldKey, 1);
    expect(newKey).not.toEqual(oldKey);
  });

  it("newVersion = currentVersion + 1", () => {
    const { newVersion } = rotateBucketKey(oldKey, 3);
    expect(newVersion).toBe(4);
  });

  it("reEncrypt roundtrips: old-encrypted data → reEncrypt → decrypt with newKey", () => {
    const { newKey, reEncrypt } = rotateBucketKey(oldKey, 1);
    const plaintext = new TextEncoder().encode("fronting log entry");
    const original = encrypt(plaintext, oldKey);
    const reEncrypted = reEncrypt(original);
    const sodium = getSodium();
    const decrypted = sodium.aeadDecrypt(reEncrypted.ciphertext, reEncrypted.nonce, null, newKey);
    expect(decrypted).toEqual(plaintext);
  });

  it("old key cannot decrypt re-encrypted data", () => {
    const { reEncrypt } = rotateBucketKey(oldKey, 1);
    const plaintext = new TextEncoder().encode("member data");
    const original = encrypt(plaintext, oldKey);
    const reEncrypted = reEncrypt(original);
    const sodium = getSodium();
    expect(() =>
      sodium.aeadDecrypt(reEncrypted.ciphertext, reEncrypted.nonce, null, oldKey),
    ).toThrow();
  });

  it("zeros intermediate plaintext after re-encryption", () => {
    const { reEncrypt } = rotateBucketKey(oldKey, 1);
    const plaintext = new TextEncoder().encode("sensitive data");
    const original = encrypt(plaintext, oldKey);
    const fillSpy = vi.spyOn(Uint8Array.prototype, "fill");
    reEncrypt(original);
    expect(fillSpy).toHaveBeenCalledWith(0);
    fillSpy.mockRestore();
  });

  it("zeros intermediate plaintext even when encrypt throws", () => {
    const { reEncrypt } = rotateBucketKey(oldKey, 1);
    const plaintext = new TextEncoder().encode("sensitive data");
    const original = encrypt(plaintext, oldKey);
    const fillSpy = vi.spyOn(Uint8Array.prototype, "fill");
    const sodium = getSodium();
    const aeadEncryptSpy = vi.spyOn(sodium, "aeadEncrypt").mockImplementation(() => {
      throw new Error("encrypt failed");
    });
    expect(() => reEncrypt(original)).toThrow("encrypt failed");
    expect(fillSpy).toHaveBeenCalledWith(0);
    fillSpy.mockRestore();
    aeadEncryptSpy.mockRestore();
  });

  it("negative currentVersion throws InvalidInputError", () => {
    expect(() => rotateBucketKey(oldKey, -1)).toThrow(InvalidInputError);
  });

  it("fractional currentVersion throws InvalidInputError", () => {
    expect(() => rotateBucketKey(oldKey, 0.5)).toThrow(InvalidInputError);
  });
});

describe("KDF parameter regression", () => {
  it("wrapping key uses KDF context 'bktkeywp' subkey 1", () => {
    const bucketKey = generateBucketKey();
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    const sodium = getSodium();
    const manualWrappingKey = sodium.kdfDeriveFromKey(32, 1, "bktkeywp", masterKey);
    try {
      const decrypted = sodium.aeadDecrypt(
        wrapped.ciphertext,
        wrapped.nonce,
        null,
        manualWrappingKey as AeadKey,
      );
      expect(decrypted).toEqual(bucketKey);
    } finally {
      sodium.memzero(manualWrappingKey);
    }
  });
});

describe("version overflow", () => {
  it("MAX_SAFE_INTEGER version throws on rotation (overflow)", () => {
    const key = generateBucketKey();
    expect(() => rotateBucketKey(key, Number.MAX_SAFE_INTEGER)).toThrow(InvalidInputError);
  });
});

describe("chained rotation", () => {
  it("key1 → key2 → key3 preserves data", () => {
    const key1 = generateBucketKey();
    const plaintext = new TextEncoder().encode("system journal");
    const encrypted1 = encrypt(plaintext, key1);

    const { newKey: key2, reEncrypt: reEncrypt1 } = rotateBucketKey(key1, 1);
    const encrypted2 = reEncrypt1(encrypted1);

    const { newKey: key3, reEncrypt: reEncrypt2 } = rotateBucketKey(key2, 2);
    const encrypted3 = reEncrypt2(encrypted2);

    const sodium = getSodium();
    const decrypted = sodium.aeadDecrypt(encrypted3.ciphertext, encrypted3.nonce, null, key3);
    expect(decrypted).toEqual(plaintext);
  });
});

describe("integration: generate → encrypt → rotate → re-encrypt → decrypt", () => {
  it("full key lifecycle roundtrip", () => {
    // Generate initial bucket key
    const bucketKey = generateBucketKey();

    // Encrypt some data with the original bucket key
    const plaintext = new TextEncoder().encode("inner world journal entry");
    const encryptedData = encrypt(plaintext, bucketKey);

    // Wrap bucket key under master key
    const wrapped = encryptBucketKey(bucketKey, masterKey, 1);
    expect(wrapped.keyVersion).toBe(1);

    // Rotate the bucket key
    const { newKey, newVersion, reEncrypt } = rotateBucketKey(bucketKey, 1);
    expect(newVersion).toBe(2);

    // Re-encrypt data under the new key
    const reEncryptedData = reEncrypt(encryptedData);

    // Wrap new bucket key under master key
    const newWrapped = encryptBucketKey(newKey, masterKey, newVersion);
    expect(newWrapped.keyVersion).toBe(2);

    // Recover the new key from storage and decrypt
    const recoveredKey = decryptBucketKey(newWrapped, masterKey);
    const sodium = getSodium();
    const decrypted = sodium.aeadDecrypt(
      reEncryptedData.ciphertext,
      reEncryptedData.nonce,
      null,
      recoveredKey,
    );
    expect(decrypted).toEqual(plaintext);
  });
});
