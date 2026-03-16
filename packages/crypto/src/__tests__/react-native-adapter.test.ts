import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  AEAD_KEY_BYTES,
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
import {
  CryptoNotReadyError,
  DecryptionFailedError,
  UnsupportedOperationError,
} from "../errors.js";

import type { BoxNonce, PwhashSalt, Signature } from "../types.js";

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

function fromBytes(b: Uint8Array): string {
  return String.fromCharCode(...b);
}

// Mock react-native-libsodium with real WASM libsodium so tests exercise actual crypto math
vi.mock("react-native-libsodium", async () => {
  const sodiumModule = await import("libsodium-wrappers-sumo");
  const sodium = sodiumModule.default;
  await sodium.ready;
  return {
    ...sodium,
    loadSumoVersion: vi.fn().mockResolvedValue(undefined),
    ready: Promise.resolve(),
  };
});

// Import after mock is set up
const { ReactNativeSodiumAdapter } = await import("../adapter/react-native-adapter.js");

describe("ReactNativeSodiumAdapter", () => {
  let adapter: InstanceType<typeof ReactNativeSodiumAdapter>;

  // ── Initialization ─────────────────────────────────────────────────

  describe("initialization", () => {
    it("isReady() returns false before init", () => {
      const fresh = new ReactNativeSodiumAdapter();
      expect(fresh.isReady()).toBe(false);
    });

    it("throws CryptoNotReadyError before init", () => {
      const fresh = new ReactNativeSodiumAdapter();
      expect(() => fresh.aeadKeygen()).toThrow(CryptoNotReadyError);
    });

    it("init() completes successfully with mock", async () => {
      const fresh = new ReactNativeSodiumAdapter();
      await fresh.init();
      expect(fresh.isReady()).toBe(true);
    });

    it("init() is idempotent", async () => {
      const fresh = new ReactNativeSodiumAdapter();
      await fresh.init();
      await fresh.init();
      expect(fresh.isReady()).toBe(true);
    });
  });

  // Initialize adapter once for all crypto operation tests
  beforeAll(async () => {
    adapter = new ReactNativeSodiumAdapter();
    await adapter.init();
  });

  // ── AEAD ───────────────────────────────────────────────────────────

  describe("AEAD", () => {
    it("encrypt/decrypt roundtrip", () => {
      const key = adapter.aeadKeygen();
      const plaintext = toBytes("hello world");
      const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
      const decrypted = adapter.aeadDecrypt(ciphertext, nonce, null, key);
      expect(fromBytes(decrypted)).toBe("hello world");
    });

    it("roundtrip with additional data", () => {
      const key = adapter.aeadKeygen();
      const plaintext = toBytes("secret");
      const ad = toBytes("context");
      const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, ad, key);
      const decrypted = adapter.aeadDecrypt(ciphertext, nonce, ad, key);
      expect(fromBytes(decrypted)).toBe("secret");
    });

    it("fails with wrong key", () => {
      const key1 = adapter.aeadKeygen();
      const key2 = adapter.aeadKeygen();
      const { ciphertext, nonce } = adapter.aeadEncrypt(new Uint8Array([1, 2, 3]), null, key1);
      expect(() => adapter.aeadDecrypt(ciphertext, nonce, null, key2)).toThrow(
        DecryptionFailedError,
      );
    });

    it("fails with tampered ciphertext", () => {
      const key = adapter.aeadKeygen();
      const { ciphertext, nonce } = adapter.aeadEncrypt(new Uint8Array([1, 2, 3]), null, key);
      const tampered = new Uint8Array(ciphertext);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      expect(() => adapter.aeadDecrypt(tampered, nonce, null, key)).toThrow(DecryptionFailedError);
    });

    it("aeadKeygen() returns key of correct size", () => {
      const key = adapter.aeadKeygen();
      expect(key).toHaveLength(AEAD_KEY_BYTES);
    });
  });

  // ── Box ────────────────────────────────────────────────────────────

  describe("Box", () => {
    function randomNonce(): BoxNonce {
      return adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
    }

    it("boxKeypair() generates keys of correct sizes", () => {
      const kp = adapter.boxKeypair();
      expect(kp.publicKey).toHaveLength(BOX_PUBLIC_KEY_BYTES);
      expect(kp.secretKey).toHaveLength(BOX_SECRET_KEY_BYTES);
    });

    it("boxSeedKeypair() derives same keypair from same seed", () => {
      const seed = adapter.randomBytes(32);
      const kp1 = adapter.boxSeedKeypair(seed);
      const kp2 = adapter.boxSeedKeypair(seed);
      expect(kp1.publicKey).toEqual(kp2.publicKey);
      expect(kp1.secretKey).toEqual(kp2.secretKey);
    });

    it("encrypt/decrypt roundtrip between two keypairs", () => {
      const alice = adapter.boxKeypair();
      const bob = adapter.boxKeypair();
      const nonce = randomNonce();
      const plaintext = toBytes("hello bob");
      const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);
      const decrypted = adapter.boxOpenEasy(ciphertext, nonce, alice.publicKey, bob.secretKey);
      expect(fromBytes(decrypted)).toBe("hello bob");
    });

    it("fails with wrong recipient key", () => {
      const alice = adapter.boxKeypair();
      const bob = adapter.boxKeypair();
      const eve = adapter.boxKeypair();
      const nonce = randomNonce();
      const ciphertext = adapter.boxEasy(toBytes("secret"), nonce, bob.publicKey, alice.secretKey);
      expect(() => adapter.boxOpenEasy(ciphertext, nonce, alice.publicKey, eve.secretKey)).toThrow(
        DecryptionFailedError,
      );
    });

    it("detects tampered ciphertext", () => {
      const alice = adapter.boxKeypair();
      const bob = adapter.boxKeypair();
      const nonce = randomNonce();
      const ciphertext = adapter.boxEasy(toBytes("data"), nonce, bob.publicKey, alice.secretKey);
      const tampered = new Uint8Array(ciphertext);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      expect(() => adapter.boxOpenEasy(tampered, nonce, alice.publicKey, bob.secretKey)).toThrow(
        DecryptionFailedError,
      );
    });
  });

  // ── Sign ───────────────────────────────────────────────────────────

  describe("Sign", () => {
    it("signKeypair() generates keys of correct sizes", () => {
      const kp = adapter.signKeypair();
      expect(kp.publicKey).toHaveLength(SIGN_PUBLIC_KEY_BYTES);
      expect(kp.secretKey).toHaveLength(SIGN_SECRET_KEY_BYTES);
    });

    it("signSeedKeypair() throws UnsupportedOperationError", () => {
      expect(() => adapter.signSeedKeypair()).toThrow(UnsupportedOperationError);
    });

    it("signDetached + signVerifyDetached roundtrip", () => {
      const kp = adapter.signKeypair();
      const message = toBytes("important message");
      const signature = adapter.signDetached(message, kp.secretKey);
      expect(signature).toHaveLength(SIGN_BYTES);
      expect(adapter.signVerifyDetached(signature, message, kp.publicKey)).toBe(true);
    });

    it("signVerifyDetached returns false for invalid signature", () => {
      const kp = adapter.signKeypair();
      const message = toBytes("important message");
      const signature = adapter.signDetached(message, kp.secretKey);
      const tampered = new Uint8Array(signature);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      const result = adapter.signVerifyDetached(tampered as Signature, message, kp.publicKey);
      expect(result).toBe(false);
    });

    it("signVerifyDetached catch branch returns false on library throw", () => {
      const kp = adapter.signKeypair();
      const message = toBytes("data");
      const badSig = adapter.randomBytes(SIGN_BYTES) as Signature;
      const result = adapter.signVerifyDetached(badSig, message, kp.publicKey);
      expect(result).toBe(false);
    });
  });

  // ── Pwhash ─────────────────────────────────────────────────────────

  describe("Pwhash", () => {
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

  // ── KDF ────────────────────────────────────────────────────────────

  describe("KDF", () => {
    it("kdfKeygen() returns key of correct size", () => {
      const key = adapter.kdfKeygen();
      expect(key).toHaveLength(KDF_KEY_BYTES);
    });

    it("kdfDeriveFromKey() same inputs produce same output", () => {
      const masterKey = adapter.kdfKeygen();
      const sub1 = adapter.kdfDeriveFromKey(KDF_BYTES_MIN, 1, "testctx!", masterKey);
      const sub2 = adapter.kdfDeriveFromKey(KDF_BYTES_MIN, 1, "testctx!", masterKey);
      expect(sub1).toEqual(sub2);
      expect(sub1).toHaveLength(KDF_BYTES_MIN);
    });
  });

  // ── Random & Memory ────────────────────────────────────────────────

  describe("Random & Memory", () => {
    it("randomBytes() returns buffer of requested length", () => {
      const buf = adapter.randomBytes(64);
      expect(buf).toHaveLength(64);
    });

    it("memzero() fills buffer with zeros (polyfill)", () => {
      const buf = new Uint8Array([1, 2, 3, 4, 5]);
      adapter.memzero(buf);
      expect(buf).toEqual(new Uint8Array(5));
    });

    it("supportsSecureMemzero is false without NativeMemzero", () => {
      expect(adapter.supportsSecureMemzero).toBe(false);
    });
  });

  // ── NativeMemzero injection ───────────────────────────────────────

  describe("NativeMemzero injection", () => {
    it("supportsSecureMemzero is true when NativeMemzero is provided", () => {
      const nativeMemzero = { memzero: vi.fn() };
      const adapterWithNative = new ReactNativeSodiumAdapter(nativeMemzero);
      expect(adapterWithNative.supportsSecureMemzero).toBe(true);
    });

    it("delegates memzero to NativeMemzero when provided", async () => {
      const nativeMemzero = { memzero: vi.fn() };
      const adapterWithNative = new ReactNativeSodiumAdapter(nativeMemzero);
      await adapterWithNative.init();
      const buf = new Uint8Array([1, 2, 3]);
      adapterWithNative.memzero(buf);
      expect(nativeMemzero.memzero).toHaveBeenCalledWith(buf);
    });

    it("does not call buffer.fill when NativeMemzero is provided", async () => {
      const nativeMemzero = { memzero: vi.fn() };
      const adapterWithNative = new ReactNativeSodiumAdapter(nativeMemzero);
      await adapterWithNative.init();
      const buf = new Uint8Array([1, 2, 3]);
      const fillSpy = vi.spyOn(buf, "fill");
      adapterWithNative.memzero(buf);
      expect(fillSpy).not.toHaveBeenCalled();
    });

    it("uses polyfill when no NativeMemzero is provided", () => {
      const adapterWithoutNative = new ReactNativeSodiumAdapter();
      const buf = new Uint8Array([1, 2, 3, 4]);
      adapterWithoutNative.memzero(buf);
      expect(buf).toEqual(new Uint8Array(4));
    });
  });
});
