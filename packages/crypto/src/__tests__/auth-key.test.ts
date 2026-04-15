import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deriveAuthAndPasswordKeys,
  generateChallengeNonce,
  hashAuthKey,
  signChallenge,
  verifyAuthKey,
  verifyChallenge,
} from "../auth-key.js";
import {
  AUTH_KEY_BYTES,
  AUTH_KEY_HASH_BYTES,
  CHALLENGE_NONCE_BYTES,
  PASSWORD_KEY_BYTES,
} from "../crypto.constants.js";
import { InvalidInputError } from "../errors.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { PwhashSalt } from "../types.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("deriveAuthAndPasswordKeys", () => {
  it("produces authKey of AUTH_KEY_BYTES length", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    expect(authKey.length).toBe(AUTH_KEY_BYTES);
  });

  it("produces passwordKey of PASSWORD_KEY_BYTES length", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { passwordKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    expect(passwordKey.length).toBe(PASSWORD_KEY_BYTES);
  });

  it("is deterministic — same inputs produce same keys", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const pw = toBytes("deterministicpw");
    const r1 = await deriveAuthAndPasswordKeys(pw, salt);
    const r2 = await deriveAuthAndPasswordKeys(pw, salt);
    expect(r1.authKey).toEqual(r2.authKey);
    expect(r1.passwordKey).toEqual(r2.passwordKey);
  });

  it("authKey and passwordKey are different", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey, passwordKey } = await deriveAuthAndPasswordKeys(
      toBytes("validpassword"),
      salt,
    );
    expect(authKey).not.toEqual(passwordKey);
  });

  it("different salts produce different keys", async () => {
    const adapter = getSodium();
    const pw = toBytes("samepassword123");
    const salt1 = adapter.randomBytes(16) as PwhashSalt;
    const salt2 = adapter.randomBytes(16) as PwhashSalt;
    const r1 = await deriveAuthAndPasswordKeys(pw, salt1);
    const r2 = await deriveAuthAndPasswordKeys(pw, salt2);
    expect(r1.authKey).not.toEqual(r2.authKey);
  });

  it("different passwords produce different keys", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const r1 = await deriveAuthAndPasswordKeys(toBytes("password-alpha"), salt);
    const r2 = await deriveAuthAndPasswordKeys(toBytes("password-beta0"), salt);
    expect(r1.authKey).not.toEqual(r2.authKey);
  });

  it("rejects passwords shorter than MIN_PASSWORD_LENGTH (8)", () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    expect(() => deriveAuthAndPasswordKeys(toBytes("short"), salt)).toThrow(InvalidInputError);
  });

  it("accepts passwords exactly 8 characters", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    await expect(deriveAuthAndPasswordKeys(toBytes("exactly8"), salt)).resolves.not.toThrow();
  });
});

describe("hashAuthKey", () => {
  it("produces a hash of AUTH_KEY_HASH_BYTES length", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    const hash = hashAuthKey(authKey);
    expect(hash.length).toBe(AUTH_KEY_HASH_BYTES);
  });

  it("is deterministic for the same key", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    expect(hashAuthKey(authKey)).toEqual(hashAuthKey(authKey));
  });

  it("produces different hashes for different keys", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey: key1 } = await deriveAuthAndPasswordKeys(toBytes("password-alpha"), salt);
    const { authKey: key2 } = await deriveAuthAndPasswordKeys(toBytes("password-beta0"), salt);
    expect(hashAuthKey(key1)).not.toEqual(hashAuthKey(key2));
  });
});

describe("verifyAuthKey", () => {
  it("returns true for the correct auth key", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    const stored = hashAuthKey(authKey);
    expect(verifyAuthKey(authKey, stored)).toBe(true);
  });

  it("returns false for a different auth key", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    const stored = hashAuthKey(authKey);
    const { authKey: wrongKey } = await deriveAuthAndPasswordKeys(toBytes("wrongpassword"), salt);
    expect(verifyAuthKey(wrongKey, stored)).toBe(false);
  });

  it("returns false for a zero-filled auth key", async () => {
    const adapter = getSodium();
    const salt = adapter.randomBytes(16) as PwhashSalt;
    const { authKey } = await deriveAuthAndPasswordKeys(toBytes("validpassword"), salt);
    const stored = hashAuthKey(authKey);
    const zeroKey = new Uint8Array(AUTH_KEY_BYTES);
    expect(verifyAuthKey(zeroKey, stored)).toBe(false);
  });
});

describe("generateChallengeNonce", () => {
  it("produces CHALLENGE_NONCE_BYTES random bytes", () => {
    const nonce = generateChallengeNonce();
    expect(nonce.length).toBe(CHALLENGE_NONCE_BYTES);
  });

  it("produces unique nonces on each call", () => {
    const a = generateChallengeNonce();
    const b = generateChallengeNonce();
    expect(a).not.toEqual(b);
  });
});

describe("adapter.memcmp (constant-time comparison)", () => {
  it("returns true for identical buffers", () => {
    const adapter = getSodium();
    const buf = adapter.randomBytes(32);
    expect(adapter.memcmp(buf, new Uint8Array(buf))).toBe(true);
  });

  it("returns false for different buffers", () => {
    const adapter = getSodium();
    const a = adapter.randomBytes(32);
    const b = adapter.randomBytes(32);
    expect(adapter.memcmp(a, b)).toBe(false);
  });
});

describe("signChallenge / verifyChallenge", () => {
  it("roundtrip: signed nonce verifies with the correct public key", () => {
    const adapter = getSodium();
    const kp = adapter.signKeypair();
    const nonce = generateChallengeNonce();
    const sig = signChallenge(nonce, kp.secretKey);
    expect(verifyChallenge(nonce, sig, kp.publicKey)).toBe(true);
  });

  it("rejects verification with a different public key", () => {
    const adapter = getSodium();
    const alice = adapter.signKeypair();
    const bob = adapter.signKeypair();
    const nonce = generateChallengeNonce();
    const sig = signChallenge(nonce, alice.secretKey);
    expect(verifyChallenge(nonce, sig, bob.publicKey)).toBe(false);
  });

  it("rejects a tampered nonce", () => {
    const adapter = getSodium();
    const kp = adapter.signKeypair();
    const nonce = generateChallengeNonce();
    const sig = signChallenge(nonce, kp.secretKey);
    const tampered = new Uint8Array(nonce);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(verifyChallenge(tampered, sig, kp.publicKey)).toBe(false);
  });
});
