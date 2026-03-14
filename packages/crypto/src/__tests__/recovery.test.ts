import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { deriveMasterKey, generateSalt } from "../master-key.js";
import { generateRecoveryKey, isValidRecoveryKeyFormat, recoverMasterKey } from "../recovery.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { KdfMasterKey } from "../types.js";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  await setupSodium();
  const salt = generateSalt();
  masterKey = await deriveMasterKey("test-password", salt, "mobile");
});

afterAll(teardownSodium);

describe("generateRecoveryKey", () => {
  it("returns a displayKey and encryptedMasterKey", () => {
    const result = generateRecoveryKey(masterKey);
    expect(result.displayKey).toBeDefined();
    expect(result.encryptedMasterKey).toBeDefined();
    expect(result.encryptedMasterKey.ciphertext).toBeInstanceOf(Uint8Array);
    expect(result.encryptedMasterKey.nonce).toBeInstanceOf(Uint8Array);
  });

  it("displayKey passes format validation", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    expect(isValidRecoveryKeyFormat(displayKey)).toBe(true);
  });

  it("displayKey contains only valid base32 chars and dashes", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    expect(displayKey).toMatch(/^[A-Z2-7-]+$/);
  });

  it("displayKey is 64 chars total (52 base32 + 12 dashes)", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    expect(displayKey.length).toBe(64);
  });

  it("displayKey has 13 groups of 4", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    const groups = displayKey.split("-");
    expect(groups).toHaveLength(13);
    for (const group of groups) {
      expect(group).toHaveLength(4);
    }
  });

  it("two calls produce different display keys", () => {
    const result1 = generateRecoveryKey(masterKey);
    const result2 = generateRecoveryKey(masterKey);
    expect(result1.displayKey).not.toBe(result2.displayKey);
  });

  it("memzeros recovery key bytes", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    generateRecoveryKey(masterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });
});

describe("recoverMasterKey", () => {
  it("roundtrip: generate then recover yields original master key bytes", () => {
    const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
    const recovered = recoverMasterKey(displayKey, encryptedMasterKey);
    expect(recovered).toEqual(masterKey);
  });

  it("recovered key is 32 bytes (KdfMasterKey size)", () => {
    const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
    const recovered = recoverMasterKey(displayKey, encryptedMasterKey);
    expect(recovered.length).toBe(32);
  });

  it("wrong displayKey throws DecryptionFailedError", () => {
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    // Generate a different (valid-format) key
    const { displayKey: wrongKey } = generateRecoveryKey(masterKey);
    expect(() => recoverMasterKey(wrongKey, encryptedMasterKey)).toThrow(DecryptionFailedError);
  });

  it("tampered encryptedMasterKey throws DecryptionFailedError", () => {
    const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
    const tampered = new Uint8Array(encryptedMasterKey.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() =>
      recoverMasterKey(displayKey, { ...encryptedMasterKey, ciphertext: tampered }),
    ).toThrow(DecryptionFailedError);
  });

  it("memzeros recovery key bytes on success", () => {
    const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    recoverMasterKey(displayKey, encryptedMasterKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("memzeros recovery key bytes on error", () => {
    const { displayKey, encryptedMasterKey } = generateRecoveryKey(masterKey);
    const tampered = new Uint8Array(encryptedMasterKey.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    expect(() =>
      recoverMasterKey(displayKey, { ...encryptedMasterKey, ciphertext: tampered }),
    ).toThrow(DecryptionFailedError);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("invalid format throws InvalidInputError (not DecryptionFailedError)", () => {
    const { encryptedMasterKey } = generateRecoveryKey(masterKey);
    expect(() => recoverMasterKey("not-a-valid-key", encryptedMasterKey)).toThrow(
      InvalidInputError,
    );
  });
});

describe("isValidRecoveryKeyFormat", () => {
  it("valid format returns true", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    expect(isValidRecoveryKeyFormat(displayKey)).toBe(true);
  });

  it("rejects lowercase chars", () => {
    expect(
      isValidRecoveryKeyFormat("abcd-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST"),
    ).toBe(false);
  });

  it("rejects missing dashes (no separator)", () => {
    // 52 chars with no dashes
    expect(isValidRecoveryKeyFormat("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST")).toBe(
      false,
    );
  });

  it("rejects wrong group count (12 groups instead of 13)", () => {
    // 12 groups of 4
    expect(
      isValidRecoveryKeyFormat("ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP"),
    ).toBe(false);
  });

  it("rejects wrong group count (14 groups instead of 13)", () => {
    expect(
      isValidRecoveryKeyFormat(
        "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST-UVWX",
      ),
    ).toBe(false);
  });

  it("rejects digit 0 (not in base32 alphabet)", () => {
    expect(
      isValidRecoveryKeyFormat("0BCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST"),
    ).toBe(false);
  });

  it("rejects digit 1 (not in base32 alphabet)", () => {
    expect(
      isValidRecoveryKeyFormat("1BCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST"),
    ).toBe(false);
  });

  it("rejects digit 8 (not in base32 alphabet)", () => {
    expect(
      isValidRecoveryKeyFormat("8BCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST"),
    ).toBe(false);
  });

  it("rejects digit 9 (not in base32 alphabet)", () => {
    expect(
      isValidRecoveryKeyFormat("9BCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST"),
    ).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRecoveryKeyFormat("")).toBe(false);
  });

  it("rejects too short (12 groups)", () => {
    expect(
      isValidRecoveryKeyFormat("ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP"),
    ).toBe(false);
  });

  it("rejects too long (14 groups)", () => {
    const { displayKey } = generateRecoveryKey(masterKey);
    expect(isValidRecoveryKeyFormat(displayKey + "-ABCD")).toBe(false);
  });

  it("rejects groups of wrong size (5 chars instead of 4)", () => {
    expect(
      isValidRecoveryKeyFormat(
        "ABCDE-FGHIJ-KLMNO-PQRST-UVWXY-Z2345-67ABC-DEFGH-IJKLM-NOPQR-STUVW-XYZ23-4567A",
      ),
    ).toBe(false);
  });
});
