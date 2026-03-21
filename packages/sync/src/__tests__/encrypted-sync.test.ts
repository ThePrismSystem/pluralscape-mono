import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  encryptChange,
  decryptChange,
  encryptSnapshot,
  decryptSnapshot,
  verifyEnvelopeSignature,
  SignatureVerificationError,
} from "../encrypted-sync.js";

import { docId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;
const DOCUMENT_ID = docId("doc-test-001");

const BYTE_RANGE = 256;

function testBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = i % BYTE_RANGE;
  }
  return bytes;
}

const XOR_MASK = 0xff;

function flipFirstByte(source: Uint8Array): Uint8Array {
  const copy = new Uint8Array(source);
  copy[0] = (copy[0] ?? 0) ^ XOR_MASK;
  return copy;
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();

  const signingKeys = sodium.signKeypair();
  keys = {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys,
  };
});

describe("encryptChange / decryptChange", () => {
  it("1.1 — produces ciphertext different from plaintext", () => {
    const plaintext = testBytes(32);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    expect(envelope.ciphertext).not.toEqual(plaintext);
    expect(envelope.ciphertext.length).toBeGreaterThan(plaintext.length);
  });

  it("1.2 — decryptChange recovers original change bytes", () => {
    const plaintext = testBytes(64);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const withSeq = { ...envelope, seq: 0 };
    const recovered = decryptChange(withSeq, keys.encryptionKey, sodium);
    expect(recovered).toEqual(plaintext);
  });

  it("1.3 — decryptChange throws with wrong key", () => {
    const plaintext = testBytes(32);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const wrongKey = sodium.aeadKeygen();
    const withSeq = { ...envelope, seq: 0 };
    expect(() => decryptChange(withSeq, wrongKey, sodium)).toThrow();
  });

  it("1.4 — decryptChange throws when ciphertext is tampered", () => {
    const plaintext = testBytes(32);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const tampered = flipFirstByte(envelope.ciphertext);
    const withSeq = { ...envelope, ciphertext: tampered, seq: 0 };
    expect(() => decryptChange(withSeq, keys.encryptionKey, sodium)).toThrow(
      SignatureVerificationError,
    );
  });

  it("1.5 — decryptChange rejects envelope with wrong documentId", () => {
    const plaintext = testBytes(32);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const wrongDoc = { ...envelope, documentId: docId("doc-wrong-999"), seq: 0 };
    // Signature check passes (signed over ciphertext), but AD mismatch causes decryption failure
    expect(() => decryptChange(wrongDoc, keys.encryptionKey, sodium)).toThrow();
  });
});

describe("verifyEnvelopeSignature", () => {
  it("1.6 — returns true for valid envelope", () => {
    const plaintext = testBytes(16);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const withSeq = { ...envelope, seq: 0 };
    expect(verifyEnvelopeSignature(withSeq, sodium)).toBe(true);
  });

  it("1.7 — returns false for tampered ciphertext", () => {
    const plaintext = testBytes(16);
    const envelope = encryptChange(plaintext, DOCUMENT_ID, keys, sodium);
    const tampered = flipFirstByte(envelope.ciphertext);
    const withSeq = { ...envelope, ciphertext: tampered, seq: 0 };
    expect(verifyEnvelopeSignature(withSeq, sodium)).toBe(false);
  });
});

describe("encryptSnapshot / decryptSnapshot", () => {
  it("1.8 — roundtrip preserves snapshot bytes", () => {
    const snapshot = testBytes(128);
    const envelope = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    const recovered = decryptSnapshot(envelope, keys.encryptionKey, sodium);
    expect(recovered).toEqual(snapshot);
  });

  it("1.9 — AD uses explicit big-endian encoding for snapshotVersion", () => {
    const snapshot = testBytes(64);

    const envelope1 = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    const envelope2 = encryptSnapshot(snapshot, DOCUMENT_ID, 2, keys, sodium);

    // Decrypting with wrong version should fail (AD mismatch)
    const wrongVersion = { ...envelope1, snapshotVersion: 2 };
    expect(() => decryptSnapshot(wrongVersion, keys.encryptionKey, sodium)).toThrow();

    // Correct versions decrypt fine
    expect(decryptSnapshot(envelope1, keys.encryptionKey, sodium)).toEqual(snapshot);
    expect(decryptSnapshot(envelope2, keys.encryptionKey, sodium)).toEqual(snapshot);
  });

  it("1.10 — decryptSnapshot throws SignatureVerificationError when ciphertext is tampered", () => {
    const snapshot = testBytes(64);
    const envelope = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    const tampered = { ...envelope, ciphertext: flipFirstByte(envelope.ciphertext) };
    expect(() => decryptSnapshot(tampered, keys.encryptionKey, sodium)).toThrow(
      SignatureVerificationError,
    );
  });

  it("1.11 — decryptSnapshot throws with wrong encryption key", () => {
    const snapshot = testBytes(64);
    const envelope = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    const wrongKey = sodium.aeadKeygen();
    expect(() => decryptSnapshot(envelope, wrongKey, sodium)).toThrow();
  });
});
