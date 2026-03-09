import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { SIGN_BYTES, SIGN_PUBLIC_KEY_BYTES, SIGN_SECRET_KEY_BYTES } from "../constants.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("Ed25519 sign/verify", () => {
  it("verifies a valid signature", () => {
    const kp = adapter.signKeypair();
    const message = toBytes("sign this message");

    const signature = adapter.signDetached(message, kp.secretKey);
    const valid = adapter.signVerifyDetached(signature, message, kp.publicKey);

    expect(valid).toBe(true);
  });

  it("rejects a tampered message", () => {
    const kp = adapter.signKeypair();
    const message = toBytes("original message");

    const signature = adapter.signDetached(message, kp.secretKey);
    const tampered = toBytes("tampered message");

    const valid = adapter.signVerifyDetached(signature, tampered, kp.publicKey);
    expect(valid).toBe(false);
  });

  it("rejects a signature with the wrong public key", () => {
    const alice = adapter.signKeypair();
    const bob = adapter.signKeypair();
    const message = toBytes("alice signed this");

    const signature = adapter.signDetached(message, alice.secretKey);
    const valid = adapter.signVerifyDetached(signature, message, bob.publicKey);

    expect(valid).toBe(false);
  });

  it("produces a signature of the correct size", () => {
    const kp = adapter.signKeypair();
    const signature = adapter.signDetached(toBytes("x"), kp.secretKey);
    expect(signature.length).toBe(SIGN_BYTES);
  });
});

describe("signKeypair", () => {
  it("generates keys of correct sizes", () => {
    const kp = adapter.signKeypair();
    expect(kp.publicKey.length).toBe(SIGN_PUBLIC_KEY_BYTES);
    expect(kp.secretKey.length).toBe(SIGN_SECRET_KEY_BYTES);
  });

  it("generates unique keypairs", () => {
    const a = adapter.signKeypair();
    const b = adapter.signKeypair();
    expect(a.publicKey).not.toEqual(b.publicKey);
  });
});

describe("signSeedKeypair", () => {
  it("derives the same keypair from the same seed", () => {
    const seed = adapter.randomBytes(32);
    const kp1 = adapter.signSeedKeypair(seed);
    const kp2 = adapter.signSeedKeypair(seed);

    expect(kp1.publicKey).toEqual(kp2.publicKey);
    expect(kp1.secretKey).toEqual(kp2.secretKey);
  });

  it("derives different keypairs from different seeds", () => {
    const seed1 = adapter.randomBytes(32);
    const seed2 = adapter.randomBytes(32);
    const kp1 = adapter.signSeedKeypair(seed1);
    const kp2 = adapter.signSeedKeypair(seed2);

    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
  });
});
