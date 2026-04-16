import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deriveAuthAndPasswordKeys } from "../auth-key.js";
import { DecryptionFailedError } from "../errors.js";
import { generateMasterKey, unwrapMasterKey, wrapMasterKey } from "../master-key-wrap.js";
import { generateSalt } from "../master-key.js";

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

describe("wrapMasterKey / unwrapMasterKey", () => {
  it("round-trip yields identical MasterKey", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const password = new TextEncoder().encode("round-trip-password");
    const { passwordKey } = await deriveAuthAndPasswordKeys(password, salt);
    const wrapped = wrapMasterKey(masterKey, passwordKey);
    const recovered = unwrapMasterKey(wrapped, passwordKey);
    expect(recovered).toEqual(masterKey);
  });

  it("wrong passwordKey throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const correctPassword = new TextEncoder().encode("correct-password");
    const wrongPassword = new TextEncoder().encode("wrong-password000");
    const { passwordKey } = await deriveAuthAndPasswordKeys(correctPassword, salt);
    const { passwordKey: wrongKey } = await deriveAuthAndPasswordKeys(wrongPassword, salt);
    const wrapped = wrapMasterKey(masterKey, passwordKey);
    expect(() => unwrapMasterKey(wrapped, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered blob throws DecryptionFailedError", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const password = new TextEncoder().encode("tamper-test-pw");
    const { passwordKey } = await deriveAuthAndPasswordKeys(password, salt);
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
    const password = new TextEncoder().encode("nonce-test-pw00");
    const { passwordKey } = await deriveAuthAndPasswordKeys(password, salt);
    const wrapped1 = wrapMasterKey(masterKey, passwordKey);
    const wrapped2 = wrapMasterKey(masterKey, passwordKey);
    expect(wrapped1.nonce).not.toEqual(wrapped2.nonce);
  });
});
