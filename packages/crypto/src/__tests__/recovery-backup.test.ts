import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AEAD_NONCE_BYTES } from "../constants.js";
import { InvalidInputError } from "../errors.js";
import { generateMasterKey } from "../master-key-wrap.js";
import { deserializeRecoveryBackup, serializeRecoveryBackup } from "../recovery-backup.js";
import { generateRecoveryKey } from "../recovery.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("serializeRecoveryBackup / deserializeRecoveryBackup", () => {
  it("round-trip produces identical nonce and ciphertext", () => {
    const masterKey = generateMasterKey();
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    const blob = serializeRecoveryBackup(encryptedMasterKey);
    const restored = deserializeRecoveryBackup(blob);
    expect(restored.nonce).toEqual(encryptedMasterKey.nonce);
    expect(restored.ciphertext).toEqual(encryptedMasterKey.ciphertext);
  });

  it("serialized blob length is nonce + ciphertext length", () => {
    const masterKey = generateMasterKey();
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    const blob = serializeRecoveryBackup(encryptedMasterKey);
    expect(blob.length).toBe(AEAD_NONCE_BYTES + encryptedMasterKey.ciphertext.length);
  });

  it("correct nonce extraction (first 24 bytes)", () => {
    const masterKey = generateMasterKey();
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    const blob = serializeRecoveryBackup(encryptedMasterKey);
    const nonce = blob.slice(0, AEAD_NONCE_BYTES);
    expect(nonce).toEqual(encryptedMasterKey.nonce);
  });

  it("correct ciphertext extraction (after 24 bytes)", () => {
    const masterKey = generateMasterKey();
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    const blob = serializeRecoveryBackup(encryptedMasterKey);
    const ciphertext = blob.slice(AEAD_NONCE_BYTES);
    expect(ciphertext).toEqual(encryptedMasterKey.ciphertext);
  });

  it("rejects blob shorter than AEAD_NONCE_BYTES", () => {
    const shortBlob = new Uint8Array(AEAD_NONCE_BYTES - 1);
    expect(() => deserializeRecoveryBackup(shortBlob)).toThrow(InvalidInputError);
  });

  it("rejects empty blob", () => {
    expect(() => deserializeRecoveryBackup(new Uint8Array(0))).toThrow(InvalidInputError);
  });

  it("accepts blob exactly AEAD_NONCE_BYTES long (zero-length ciphertext)", () => {
    const blob = new Uint8Array(AEAD_NONCE_BYTES);
    const result = deserializeRecoveryBackup(blob);
    expect(result.nonce.length).toBe(AEAD_NONCE_BYTES);
    expect(result.ciphertext.length).toBe(0);
  });
});
