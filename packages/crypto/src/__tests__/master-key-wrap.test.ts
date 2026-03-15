import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DecryptionFailedError } from "../errors.js";
import {
  derivePasswordKey,
  generateMasterKey,
  unwrapMasterKey,
  wrapMasterKey,
} from "../master-key-wrap.js";
import { generateSalt } from "../master-key.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("generateMasterKey", () => {
  it("returns a 32-byte KdfMasterKey", () => {
    const key = generateMasterKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("two calls produce different keys", () => {
    const k1 = generateMasterKey();
    const k2 = generateMasterKey();
    expect(k1).not.toEqual(k2);
  });
});

describe("derivePasswordKey", () => {
  it("returns a 32-byte AeadKey", async () => {
    const salt = generateSalt();
    const key = await derivePasswordKey("my-password", salt, "mobile");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("is deterministic for same inputs", async () => {
    const salt = generateSalt();
    const k1 = await derivePasswordKey("same-password", salt, "mobile");
    const k2 = await derivePasswordKey("same-password", salt, "mobile");
    expect(k1).toEqual(k2);
  });

  it("different passwords produce different keys", async () => {
    const salt = generateSalt();
    const k1 = await derivePasswordKey("password-A", salt, "mobile");
    const k2 = await derivePasswordKey("password-B", salt, "mobile");
    expect(k1).not.toEqual(k2);
  });

  it("different salts produce different keys", async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const k1 = await derivePasswordKey("same-password", salt1, "mobile");
    const k2 = await derivePasswordKey("same-password", salt2, "mobile");
    expect(k1).not.toEqual(k2);
  });

  it("throws InvalidInputError for empty password", () => {
    const salt = generateSalt();
    expect(() => derivePasswordKey("", salt, "mobile")).toThrow(/at least 8 characters/);
  });

  it("throws InvalidInputError for short password", () => {
    const salt = generateSalt();
    expect(() => derivePasswordKey("short", salt, "mobile")).toThrow(/at least 8 characters/);
    expect(() => derivePasswordKey("1234567", salt, "mobile")).toThrow(/at least 8 characters/);
  });

  it("accepts password of exactly 8 characters", async () => {
    const salt = generateSalt();
    const key = await derivePasswordKey("12345678", salt, "mobile");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("derives key with server profile", async () => {
    const salt = generateSalt();
    const key = await derivePasswordKey("test-password", salt, "server");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("memzeros password bytes", async () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const salt = generateSalt();
    await derivePasswordKey("test-password", salt, "mobile");
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });
});

describe("wrapMasterKey / unwrapMasterKey", () => {
  it("round-trip yields identical MasterKey", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey("round-trip-password", salt, "mobile");
    const wrapped = wrapMasterKey(masterKey, passwordKey);
    const recovered = unwrapMasterKey(wrapped, passwordKey);
    expect(recovered).toEqual(masterKey);
  });

  it("wrong passwordKey throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey("correct-password", salt, "mobile");
    const wrongKey = await derivePasswordKey("wrong-password", salt, "mobile");
    const wrapped = wrapMasterKey(masterKey, passwordKey);
    expect(() => unwrapMasterKey(wrapped, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered blob throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey("tamper-test", salt, "mobile");
    const wrapped = wrapMasterKey(masterKey, passwordKey);
    const tampered = new Uint8Array(wrapped.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => unwrapMasterKey({ ...wrapped, ciphertext: tampered }, passwordKey)).toThrow(
      DecryptionFailedError,
    );
  });

  it("each wrap produces a different ciphertext (random nonce)", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey("nonce-test", salt, "mobile");
    const wrapped1 = wrapMasterKey(masterKey, passwordKey);
    const wrapped2 = wrapMasterKey(masterKey, passwordKey);
    expect(wrapped1.nonce).not.toEqual(wrapped2.nonce);
  });
});
