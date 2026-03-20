import { beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  KDF_BYTES_MIN,
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
} from "../crypto.constants.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";

import type { BoxNonce, PwhashSalt, Signature } from "../types.js";

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

function fromBytes(b: Uint8Array): string {
  return String.fromCharCode(...b);
}

describe("BaseSodiumAdapter (via WasmSodiumAdapter)", () => {
  let adapter: WasmSodiumAdapter;

  beforeAll(async () => {
    adapter = new WasmSodiumAdapter();
    await adapter.init();
  });

  // ── AEAD (shared methods from base) ─────────────────────────────────

  describe("aeadEncrypt/aeadDecrypt (shared)", () => {
    it("encrypt/decrypt roundtrip", () => {
      const key = adapter.aeadKeygen();
      const plaintext = toBytes("base adapter test");
      const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
      const decrypted = adapter.aeadDecrypt(ciphertext, nonce, null, key);
      expect(fromBytes(decrypted)).toBe("base adapter test");
    });

    it("roundtrip with additional data", () => {
      const key = adapter.aeadKeygen();
      const plaintext = toBytes("secret data");
      const ad = toBytes("context info");
      const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, ad, key);
      const decrypted = adapter.aeadDecrypt(ciphertext, nonce, ad, key);
      expect(fromBytes(decrypted)).toBe("secret data");
    });

    it("fails with wrong key", () => {
      const key1 = adapter.aeadKeygen();
      const key2 = adapter.aeadKeygen();
      const { ciphertext, nonce } = adapter.aeadEncrypt(toBytes("data"), null, key1);
      expect(() => adapter.aeadDecrypt(ciphertext, nonce, null, key2)).toThrow(
        DecryptionFailedError,
      );
    });

    it("rejects invalid key length", () => {
      const badKey = new Uint8Array(16);
      expect(() => adapter.aeadEncrypt(toBytes("data"), null, badKey as never)).toThrow(
        InvalidInputError,
      );
    });

    it("nonce has correct length", () => {
      const key = adapter.aeadKeygen();
      const { nonce } = adapter.aeadEncrypt(toBytes("data"), null, key);
      expect(nonce).toHaveLength(AEAD_NONCE_BYTES);
    });
  });

  describe("aeadKeygen (shared)", () => {
    it("returns key of correct size", () => {
      const key = adapter.aeadKeygen();
      expect(key).toHaveLength(AEAD_KEY_BYTES);
    });
  });

  // ── Box (shared methods) ───────────────────────────────────────────

  describe("boxKeypair (shared)", () => {
    it("generates keys of correct sizes", () => {
      const kp = adapter.boxKeypair();
      expect(kp.publicKey).toHaveLength(BOX_PUBLIC_KEY_BYTES);
      expect(kp.secretKey).toHaveLength(BOX_SECRET_KEY_BYTES);
    });
  });

  describe("boxSeedKeypair (shared)", () => {
    it("derives same keypair from same seed", () => {
      const seed = adapter.randomBytes(32);
      const kp1 = adapter.boxSeedKeypair(seed);
      const kp2 = adapter.boxSeedKeypair(seed);
      expect(kp1.publicKey).toEqual(kp2.publicKey);
      expect(kp1.secretKey).toEqual(kp2.secretKey);
    });
  });

  describe("boxEasy/boxOpenEasy (shared)", () => {
    it("encrypt/decrypt roundtrip between two keypairs", () => {
      const alice = adapter.boxKeypair();
      const bob = adapter.boxKeypair();
      const nonce = adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
      const plaintext = toBytes("hello bob");
      const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);
      const decrypted = adapter.boxOpenEasy(ciphertext, nonce, alice.publicKey, bob.secretKey);
      expect(fromBytes(decrypted)).toBe("hello bob");
    });

    it("fails with wrong recipient key", () => {
      const alice = adapter.boxKeypair();
      const bob = adapter.boxKeypair();
      const eve = adapter.boxKeypair();
      const nonce = adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
      const ciphertext = adapter.boxEasy(toBytes("secret"), nonce, bob.publicKey, alice.secretKey);
      expect(() => adapter.boxOpenEasy(ciphertext, nonce, alice.publicKey, eve.secretKey)).toThrow(
        DecryptionFailedError,
      );
    });
  });

  // ── Sign (shared methods) ──────────────────────────────────────────

  describe("signKeypair (shared)", () => {
    it("generates keys of correct sizes", () => {
      const kp = adapter.signKeypair();
      expect(kp.publicKey).toHaveLength(SIGN_PUBLIC_KEY_BYTES);
      expect(kp.secretKey).toHaveLength(SIGN_SECRET_KEY_BYTES);
    });
  });

  describe("signDetached/signVerifyDetached (shared)", () => {
    it("sign and verify roundtrip", () => {
      const kp = adapter.signKeypair();
      const message = toBytes("important message");
      const signature = adapter.signDetached(message, kp.secretKey);
      expect(signature).toHaveLength(SIGN_BYTES);
      expect(adapter.signVerifyDetached(signature, message, kp.publicKey)).toBe(true);
    });

    it("returns false for invalid signature", () => {
      const kp = adapter.signKeypair();
      const message = toBytes("data");
      const badSig = adapter.randomBytes(SIGN_BYTES) as Signature;
      expect(adapter.signVerifyDetached(badSig, message, kp.publicKey)).toBe(false);
    });
  });

  // ── Pwhash (shared) ─────────────────────────────────────────────────

  describe("pwhash (shared)", () => {
    it("derives a key of requested length", () => {
      const password = toBytes("password123");
      const salt = adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
      const derived = adapter.pwhash(
        32,
        password,
        salt,
        PWHASH_OPSLIMIT_INTERACTIVE,
        PWHASH_MEMLIMIT_INTERACTIVE,
      );
      expect(derived).toHaveLength(32);
    });
  });

  // ── KDF (shared) ────────────────────────────────────────────────────

  describe("kdfDeriveFromKey (shared)", () => {
    it("same inputs produce same output", () => {
      const masterKey = adapter.kdfKeygen();
      const sub1 = adapter.kdfDeriveFromKey(KDF_BYTES_MIN, 1, "testctx!", masterKey);
      const sub2 = adapter.kdfDeriveFromKey(KDF_BYTES_MIN, 1, "testctx!", masterKey);
      expect(sub1).toEqual(sub2);
      expect(sub1).toHaveLength(KDF_BYTES_MIN);
    });
  });

  describe("kdfKeygen (shared)", () => {
    it("returns key of correct size", () => {
      const key = adapter.kdfKeygen();
      expect(key).toHaveLength(KDF_KEY_BYTES);
    });
  });

  // ── Generic Hash (shared) ──────────────────────────────────────────

  describe("genericHash (shared)", () => {
    it("produces consistent output", () => {
      const message = toBytes("test");
      const hash1 = adapter.genericHash(32, message);
      const hash2 = adapter.genericHash(32, message);
      expect(hash1).toEqual(hash2);
    });
  });

  // ── Random (shared) ────────────────────────────────────────────────

  describe("randomBytes (shared)", () => {
    it("returns buffer of requested length", () => {
      const buf = adapter.randomBytes(64);
      expect(buf).toHaveLength(64);
    });
  });

  // ── Constants ──────────────────────────────────────────────────────

  describe("constants (shared)", () => {
    it("exposes SODIUM_CONSTANTS via constants property", () => {
      expect(adapter.constants.AEAD_KEY_BYTES).toBe(AEAD_KEY_BYTES);
    });
  });
});
