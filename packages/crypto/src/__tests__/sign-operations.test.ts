import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SIGN_BYTES } from "../crypto.constants.js";
import { DecryptionFailedError, InvalidInputError, SignatureVerificationError } from "../errors.js";
import { decryptThenVerify, sign, signThenEncrypt, verify } from "../sign.js";
import { getSodium } from "../sodium.js";
import { encrypt } from "../symmetric.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { AeadKey } from "../types.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

function makeKey(): AeadKey {
  return getSodium().aeadKeygen();
}

describe("sign / verify", () => {
  it("roundtrip: sign then verify succeeds", () => {
    const kp = getSodium().signKeypair();
    const data = new TextEncoder().encode("hello, plural world");
    const sig = sign(data, kp.secretKey);
    expect(verify(data, sig, kp.publicKey)).toBe(true);
  });

  it("tampered data fails verification", () => {
    const kp = getSodium().signKeypair();
    const data = new TextEncoder().encode("original");
    const sig = sign(data, kp.secretKey);
    const tampered = new TextEncoder().encode("tampered");
    expect(verify(tampered, sig, kp.publicKey)).toBe(false);
  });

  it("wrong public key fails verification", () => {
    const alice = getSodium().signKeypair();
    const bob = getSodium().signKeypair();
    const data = new TextEncoder().encode("alice signed this");
    const sig = sign(data, alice.secretKey);
    expect(verify(data, sig, bob.publicKey)).toBe(false);
  });

  it("produces a signature of the correct length", () => {
    const kp = getSodium().signKeypair();
    const sig = sign(new Uint8Array(1), kp.secretKey);
    expect(sig.length).toBe(SIGN_BYTES);
  });

  it("signs empty data successfully", () => {
    const kp = getSodium().signKeypair();
    const data = new Uint8Array(0);
    const sig = sign(data, kp.secretKey);
    expect(verify(data, sig, kp.publicKey)).toBe(true);
  });

  it("corrupted signature fails verification", () => {
    const kp = getSodium().signKeypair();
    const data = new TextEncoder().encode("integrity check");
    const sig = sign(data, kp.secretKey);
    const corrupted = new Uint8Array(sig);
    corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
    expect(verify(data, corrupted as typeof sig, kp.publicKey)).toBe(false);
  });
});

describe("signThenEncrypt / decryptThenVerify", () => {
  it("roundtrip: sign-then-encrypt then decrypt-then-verify returns original data", () => {
    const kp = getSodium().signKeypair();
    const key = makeKey();
    const data = new TextEncoder().encode("sensitive plural data");

    const payload = signThenEncrypt(data, kp.secretKey, key);
    const recovered = decryptThenVerify(payload, key, kp.publicKey);

    expect(recovered).toEqual(data);
  });

  it("wrong decryption key throws DecryptionFailedError", () => {
    const kp = getSodium().signKeypair();
    const encKey = makeKey();
    const wrongKey = makeKey();
    const data = new TextEncoder().encode("data");

    const payload = signThenEncrypt(data, kp.secretKey, encKey);
    expect(() => decryptThenVerify(payload, wrongKey, kp.publicKey)).toThrow(DecryptionFailedError);
  });

  it("wrong signing key (verification fails) throws SignatureVerificationError", () => {
    const alice = getSodium().signKeypair();
    const bob = getSodium().signKeypair();
    const key = makeKey();
    const data = new TextEncoder().encode("data");

    // signed by alice, but we verify with bob's pubkey
    const payload = signThenEncrypt(data, alice.secretKey, key);
    expect(() => decryptThenVerify(payload, key, bob.publicKey)).toThrow(
      SignatureVerificationError,
    );
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const kp = getSodium().signKeypair();
    const key = makeKey();
    const data = new TextEncoder().encode("data");

    const payload = signThenEncrypt(data, kp.secretKey, key);
    const tampered = {
      ...payload,
      ciphertext: new Uint8Array(payload.ciphertext.length).fill(0xff),
    };
    expect(() => decryptThenVerify(tampered, key, kp.publicKey)).toThrow(DecryptionFailedError);
  });

  it("truncated inner payload (< SIGN_BYTES) throws InvalidInputError", () => {
    const kp = getSodium().signKeypair();
    const key = makeKey();
    // Encrypt something shorter than SIGN_BYTES to simulate a truncated combined payload
    const shortData = new Uint8Array(10); // Only 10 bytes, less than 64-byte signature
    const payload = encrypt(shortData, key);
    expect(() => decryptThenVerify(payload, key, kp.publicKey)).toThrow(InvalidInputError);
  });

  it("roundtrip with empty data", () => {
    const kp = getSodium().signKeypair();
    const key = makeKey();
    const data = new Uint8Array(0);

    const payload = signThenEncrypt(data, kp.secretKey, key);
    const recovered = decryptThenVerify(payload, key, kp.publicKey);
    expect(recovered).toEqual(data);
  });

  it("roundtrip with large data", { timeout: 15_000 }, () => {
    const kp = getSodium().signKeypair();
    const key = makeKey();
    const data = getSodium().randomBytes(100_000);

    const payload = signThenEncrypt(data, kp.secretKey, key);
    const recovered = decryptThenVerify(payload, key, kp.publicKey);
    expect(recovered).toEqual(data);
  });
});
