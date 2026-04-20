import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PWHASH_SALT_BYTES } from "../crypto.constants.js";
import {
  decodeQRPayload,
  decryptFromTransfer,
  deriveTransferKey,
  encodeQRPayload,
  encryptForTransfer,
  generateTransferCode,
  isValidTransferCode,
} from "../device-transfer.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { toHex } from "../hex.js";
import { generateMasterKey } from "../master-key-wrap.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("generateTransferCode", () => {
  it("returns a 10-digit numeric string", () => {
    const { verificationCode } = generateTransferCode();
    expect(verificationCode).toMatch(/^\d{10}$/);
  });

  it("two calls produce different codes", () => {
    const { verificationCode: c1 } = generateTransferCode();
    const { verificationCode: c2 } = generateTransferCode();
    // With overwhelming probability these differ; extremely rarely equal by chance
    expect(c1).not.toBe(c2);
  });

  it("codeSalt is PWHASH_SALT_BYTES bytes", () => {
    const { codeSalt } = generateTransferCode();
    expect(codeSalt.length).toBe(PWHASH_SALT_BYTES);
  });

  it("requestId is a valid UUID string", () => {
    const { requestId } = generateTransferCode();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("two calls produce different salts", () => {
    const { codeSalt: s1 } = generateTransferCode();
    const { codeSalt: s2 } = generateTransferCode();
    expect(s1).not.toEqual(s2);
  });
});

describe("deriveTransferKey", () => {
  it("same code + salt produces same key (deterministic)", () => {
    const { verificationCode, codeSalt } = generateTransferCode();
    const k1 = deriveTransferKey(verificationCode, codeSalt);
    const k2 = deriveTransferKey(verificationCode, codeSalt);
    expect(k1).toEqual(k2);
  });

  it("different codes produce different keys", () => {
    const { verificationCode: c1, codeSalt } = generateTransferCode();
    const { verificationCode: c2 } = generateTransferCode();
    const k1 = deriveTransferKey(c1, codeSalt);
    const k2 = deriveTransferKey(c2, codeSalt);
    expect(k1).not.toEqual(k2);
  });

  it("different salts produce different keys", () => {
    const { verificationCode, codeSalt: s1 } = generateTransferCode();
    const { codeSalt: s2 } = generateTransferCode();
    const k1 = deriveTransferKey(verificationCode, s1);
    const k2 = deriveTransferKey(verificationCode, s2);
    expect(k1).not.toEqual(k2);
  });

  it("invalid transfer code throws InvalidInputError", () => {
    const { codeSalt } = generateTransferCode();
    expect(() => deriveTransferKey("notacode", codeSalt)).toThrow(InvalidInputError);
  });
});

describe("encryptForTransfer / decryptFromTransfer", () => {
  it("round-trip yields original MasterKey", () => {
    const masterKey = generateMasterKey();
    const { verificationCode, codeSalt } = generateTransferCode();

    // Source: derive key + encrypt
    const transferKeySource = deriveTransferKey(verificationCode, codeSalt);
    const payload = encryptForTransfer(masterKey, transferKeySource);

    // Target: derive same key + decrypt
    const transferKeyTarget = deriveTransferKey(verificationCode, codeSalt);
    const recovered = decryptFromTransfer(payload, transferKeyTarget);
    expect(recovered).toEqual(masterKey);
  });

  it("wrong transfer key throws DecryptionFailedError", () => {
    const masterKey = generateMasterKey();
    const { verificationCode: c1, codeSalt } = generateTransferCode();
    const { verificationCode: c2 } = generateTransferCode();

    const keyForEncrypt = deriveTransferKey(c1, codeSalt);
    const payload = encryptForTransfer(masterKey, keyForEncrypt);

    const wrongKey = deriveTransferKey(c2, codeSalt);
    expect(() => decryptFromTransfer(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const masterKey = generateMasterKey();
    const { verificationCode, codeSalt } = generateTransferCode();
    const transferKey = deriveTransferKey(verificationCode, codeSalt);
    const payload = encryptForTransfer(masterKey, transferKey);

    const tampered = new Uint8Array(payload.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    // Need a fresh transfer key since the original was memzeroed
    const freshKey = deriveTransferKey(verificationCode, codeSalt);
    expect(() => decryptFromTransfer({ ...payload, ciphertext: tampered }, freshKey)).toThrow(
      DecryptionFailedError,
    );
  });
});

describe("encodeQRPayload / decodeQRPayload", () => {
  it("round-trip preserves requestId and salt (code is NOT embedded)", () => {
    const init = generateTransferCode();
    const encoded = encodeQRPayload(init);
    const decoded = decodeQRPayload(encoded);

    expect(decoded.requestId).toBe(init.requestId);
    expect(decoded.salt).toEqual(init.codeSalt);
  });

  it("encoded QR payload does not embed the verification code", () => {
    const init = generateTransferCode();
    const encoded = encodeQRPayload(init);
    const parsed = JSON.parse(encoded) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("code");
    expect(parsed).not.toHaveProperty("verificationCode");
    // Defense-in-depth: also assert the literal digit sequence is absent
    expect(encoded).not.toContain(init.verificationCode);
  });

  it("decoded QR payload has no `code` property (compile-time + runtime)", () => {
    const init = generateTransferCode();
    const decoded = decodeQRPayload(encodeQRPayload(init));
    expect(Object.hasOwn(decoded, "code")).toBe(false);
  });

  it("invalid JSON throws InvalidInputError", () => {
    expect(() => decodeQRPayload("not json at all")).toThrow(InvalidInputError);
  });

  it("missing requestId field throws InvalidInputError", () => {
    const payload = JSON.stringify({ salt: "AAAA" });
    expect(() => decodeQRPayload(payload)).toThrow(InvalidInputError);
  });

  it("missing salt field throws InvalidInputError", () => {
    const payload = JSON.stringify({ requestId: "uuid" });
    expect(() => decodeQRPayload(payload)).toThrow(InvalidInputError);
  });

  it("invalid hex in salt throws InvalidInputError", () => {
    const payload = JSON.stringify({ requestId: "uuid", salt: "ZZZZ" });
    expect(() => decodeQRPayload(payload)).toThrow(InvalidInputError);
  });

  it("wrong-length salt hex throws InvalidInputError", () => {
    // 4 hex chars = 2 bytes, not the required 16
    const payload = JSON.stringify({ requestId: "uuid", salt: "aabb" });
    expect(() => decodeQRPayload(payload)).toThrow(InvalidInputError);
  });

  it("ignores legacy `code` field if present (forward-compat for old clients)", () => {
    // An older source device encoding the code should not leak into DecodedQRPayload.
    const init = generateTransferCode();
    const legacy = JSON.stringify({
      requestId: init.requestId,
      code: init.verificationCode,
      salt: toHex(init.codeSalt),
    });
    const decoded = decodeQRPayload(legacy);
    expect(Object.hasOwn(decoded, "code")).toBe(false);
    expect(decoded.requestId).toBe(init.requestId);
  });
});

describe("isValidTransferCode", () => {
  it("accepts exactly 10 digits", () => {
    expect(isValidTransferCode("1234567890")).toBe(true);
    expect(isValidTransferCode("0000000000")).toBe(true);
    expect(isValidTransferCode("9999999999")).toBe(true);
  });

  it("rejects 8 digits (too short)", () => {
    expect(isValidTransferCode("12345678")).toBe(false);
  });

  it("rejects 11 digits (too long)", () => {
    expect(isValidTransferCode("12345678901")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidTransferCode("123456789a")).toBe(false);
    expect(isValidTransferCode("1234-67890")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTransferCode("")).toBe(false);
  });
});

describe("memzero behavior", () => {
  it("deriveTransferKey zeroes codeBytes", async () => {
    const sodium = (await import("../sodium.js")).getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const { verificationCode, codeSalt } = generateTransferCode();
    deriveTransferKey(verificationCode, codeSalt);
    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });

  it("encryptForTransfer zeroes transferKey", async () => {
    const sodium = (await import("../sodium.js")).getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const masterKey = generateMasterKey();
    const { verificationCode, codeSalt } = generateTransferCode();
    const transferKey = deriveTransferKey(verificationCode, codeSalt);
    encryptForTransfer(masterKey, transferKey);
    // memzero called for codeBytes in deriveTransferKey + transferKey in encryptForTransfer
    expect(memzeroSpy).toHaveBeenCalledTimes(2);
    memzeroSpy.mockRestore();
  });

  it("decryptFromTransfer zeroes transferKey", async () => {
    const sodium = (await import("../sodium.js")).getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    const masterKey = generateMasterKey();
    const { verificationCode, codeSalt } = generateTransferCode();
    const encKey = deriveTransferKey(verificationCode, codeSalt);
    const payload = encryptForTransfer(masterKey, encKey);
    memzeroSpy.mockClear();
    const decKey = deriveTransferKey(verificationCode, codeSalt);
    memzeroSpy.mockClear();
    decryptFromTransfer(payload, decKey);
    // memzero called for transferKey in decryptFromTransfer
    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});
