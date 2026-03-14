import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { AEAD_KEY_BYTES, KDF_KEY_BYTES } from "../constants.js";
import { _resetForTesting, configureSodium, getSodium, initSodium } from "../sodium.js";
import { deriveSyncEncryptionKey } from "../sync-keys.js";

import type { KdfMasterKey, SodiumAdapter } from "../index.js";

let sodium: SodiumAdapter;

beforeAll(async () => {
  _resetForTesting();
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();
});

afterAll(() => {
  _resetForTesting();
});

describe("deriveSyncEncryptionKey", () => {
  function makeMasterKey(): KdfMasterKey {
    return sodium.kdfKeygen();
  }

  it("returns a key of AEAD_KEY_BYTES length", () => {
    const masterKey = makeMasterKey();
    try {
      const syncKey = deriveSyncEncryptionKey(masterKey);
      try {
        expect(syncKey).toBeInstanceOf(Uint8Array);
        expect(syncKey.byteLength).toBe(AEAD_KEY_BYTES);
      } finally {
        sodium.memzero(syncKey);
      }
    } finally {
      sodium.memzero(masterKey);
    }
  });

  it("is deterministic: same master key produces same sync key", () => {
    const masterKey = makeMasterKey();
    try {
      const syncKey1 = deriveSyncEncryptionKey(masterKey);
      const syncKey2 = deriveSyncEncryptionKey(masterKey);
      try {
        expect(new Uint8Array(syncKey1)).toEqual(new Uint8Array(syncKey2));
      } finally {
        sodium.memzero(syncKey1);
        sodium.memzero(syncKey2);
      }
    } finally {
      sodium.memzero(masterKey);
    }
  });

  it("different master keys produce different sync keys", () => {
    const masterKey1 = makeMasterKey();
    const masterKey2 = makeMasterKey();
    try {
      const syncKey1 = deriveSyncEncryptionKey(masterKey1);
      const syncKey2 = deriveSyncEncryptionKey(masterKey2);
      try {
        expect(new Uint8Array(syncKey1)).not.toEqual(new Uint8Array(syncKey2));
      } finally {
        sodium.memzero(syncKey1);
        sodium.memzero(syncKey2);
      }
    } finally {
      sodium.memzero(masterKey1);
      sodium.memzero(masterKey2);
    }
  });

  it("produces a key different from a key derived with a different KDF context", () => {
    const masterKey = makeMasterKey();
    try {
      const syncKey = deriveSyncEncryptionKey(masterKey);
      const otherKey = getSodium().kdfDeriveFromKey(KDF_KEY_BYTES, 1, "othrcntx", masterKey);
      try {
        expect(new Uint8Array(syncKey)).not.toEqual(new Uint8Array(otherKey));
      } finally {
        sodium.memzero(syncKey);
        sodium.memzero(otherKey);
      }
    } finally {
      sodium.memzero(masterKey);
    }
  });

  it("returned key works with aeadEncrypt/aeadDecrypt", () => {
    const masterKey = makeMasterKey();
    try {
      const syncKey = deriveSyncEncryptionKey(masterKey);
      try {
        const plaintext = new TextEncoder().encode("test payload");
        const { ciphertext, nonce } = sodium.aeadEncrypt(plaintext, null, syncKey);
        const decrypted = sodium.aeadDecrypt(ciphertext, nonce, null, syncKey);
        expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
      } finally {
        sodium.memzero(syncKey);
      }
    } finally {
      sodium.memzero(masterKey);
    }
  });

  it("memzero works on the returned key", () => {
    const masterKey = makeMasterKey();
    try {
      const syncKey = deriveSyncEncryptionKey(masterKey);
      const copy = new Uint8Array(syncKey);
      expect(copy.some((b: number) => b !== 0)).toBe(true);

      sodium.memzero(syncKey);
      expect(syncKey.every((b: number) => b === 0)).toBe(true);
    } finally {
      sodium.memzero(masterKey);
    }
  });
});
