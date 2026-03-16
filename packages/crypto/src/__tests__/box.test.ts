import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import {
  BOX_MAC_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
} from "../crypto.constants.js";
import { DecryptionFailedError } from "../errors.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { BoxNonce } from "../types.js";

let adapter: SodiumAdapter;

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

function fromBytes(b: Uint8Array): string {
  return String.fromCharCode(...b);
}

function randomNonce(): BoxNonce {
  return adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
}

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("crypto_box roundtrip", () => {
  it("encrypts and decrypts between two keypairs", () => {
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
    const plaintext = toBytes("not for eve");

    const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);

    expect(() => adapter.boxOpenEasy(ciphertext, nonce, alice.publicKey, eve.secretKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("fails with wrong sender public key", () => {
    const alice = adapter.boxKeypair();
    const bob = adapter.boxKeypair();
    const eve = adapter.boxKeypair();
    const nonce = randomNonce();
    const plaintext = toBytes("impersonation attempt");

    const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);

    expect(() => adapter.boxOpenEasy(ciphertext, nonce, eve.publicKey, bob.secretKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("produces ciphertext with MAC overhead", () => {
    const alice = adapter.boxKeypair();
    const bob = adapter.boxKeypair();
    const nonce = randomNonce();
    const plaintext = toBytes("measure");

    const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);

    expect(ciphertext.length).toBe(plaintext.length + BOX_MAC_BYTES);
  });

  it("detects tampered ciphertext", () => {
    const alice = adapter.boxKeypair();
    const bob = adapter.boxKeypair();
    const nonce = randomNonce();
    const plaintext = toBytes("tamper test");

    const ciphertext = adapter.boxEasy(plaintext, nonce, bob.publicKey, alice.secretKey);
    const tampered = new Uint8Array(ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() => adapter.boxOpenEasy(tampered, nonce, alice.publicKey, bob.secretKey)).toThrow(
      DecryptionFailedError,
    );
  });
});

describe("boxKeypair", () => {
  it("generates keys of correct sizes", () => {
    const kp = adapter.boxKeypair();
    expect(kp.publicKey.length).toBe(BOX_PUBLIC_KEY_BYTES);
    expect(kp.secretKey.length).toBe(BOX_SECRET_KEY_BYTES);
  });

  it("generates unique keypairs", () => {
    const a = adapter.boxKeypair();
    const b = adapter.boxKeypair();
    expect(a.publicKey).not.toEqual(b.publicKey);
  });
});

describe("boxSeedKeypair", () => {
  it("derives the same keypair from the same seed", () => {
    const seed = adapter.randomBytes(32);
    const kp1 = adapter.boxSeedKeypair(seed);
    const kp2 = adapter.boxSeedKeypair(seed);

    expect(kp1.publicKey).toEqual(kp2.publicKey);
    expect(kp1.secretKey).toEqual(kp2.secretKey);
  });

  it("derives different keypairs from different seeds", () => {
    const seed1 = adapter.randomBytes(32);
    const seed2 = adapter.randomBytes(32);
    const kp1 = adapter.boxSeedKeypair(seed1);
    const kp2 = adapter.boxSeedKeypair(seed2);

    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
  });
});
