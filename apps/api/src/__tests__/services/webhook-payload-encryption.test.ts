import { AEAD_NONCE_BYTES, AEAD_TAG_BYTES, assertAeadKey, initSodium } from "@pluralscape/crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptWebhookPayload,
  encryptWebhookPayload,
} from "../../services/webhook-payload-encryption.js";

beforeAll(async () => {
  await initSodium();
});

function makeTestKey() {
  const key = new Uint8Array(32).fill(0xab);
  assertAeadKey(key);
  return key;
}

// -- encryptWebhookPayload ------------------------------------------------

describe("encryptWebhookPayload", () => {
  it("returns a non-empty Uint8Array that differs from the plaintext bytes", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"member.created","systemId":"sys_test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);

    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(Buffer.from(encrypted).toString()).not.toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (nonce varies)", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"member.created"}';

    const encrypted1 = encryptWebhookPayload(plaintext, key);
    const encrypted2 = encryptWebhookPayload(plaintext, key);

    // Extremely unlikely to collide with random nonces
    expect(encrypted1).not.toEqual(encrypted2);
  });

  it("output length exceeds plaintext length (nonce + MAC overhead)", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });
});

// -- encrypt → decrypt round-trip -----------------------------------------

describe("encrypt → decrypt round-trip", () => {
  it("decrypts normal JSON payload", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"member.created","systemId":"sys_test"}';
    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(decryptWebhookPayload(encrypted, key)).toBe(plaintext);
  });

  it("decrypts empty string", () => {
    const key = makeTestKey();
    const encrypted = encryptWebhookPayload("", key);
    expect(decryptWebhookPayload(encrypted, key)).toBe("");
  });

  it("decrypts large payload", () => {
    const key = makeTestKey();
    const plaintext = "x".repeat(10_000);
    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(decryptWebhookPayload(encrypted, key)).toBe(plaintext);
  });

  it("decrypts unicode content", () => {
    const key = makeTestKey();
    const plaintext = '{"emoji":"🎉","cjk":"日本語"}';
    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(decryptWebhookPayload(encrypted, key)).toBe(plaintext);
  });
});

// -- ciphertext structure --------------------------------------------------

describe("ciphertext structure", () => {
  it("output length equals nonce + plaintext + auth tag", () => {
    const key = makeTestKey();
    const plaintext = "hello";
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(encrypted.length).toBe(AEAD_NONCE_BYTES + plaintextBytes.length + AEAD_TAG_BYTES);
  });
});

// -- decryptWebhookPayload failures ----------------------------------------

describe("decryptWebhookPayload failures", () => {
  it("throws on wrong key", () => {
    const key1 = makeTestKey();
    const key2 = new Uint8Array(32).fill(0xcd);
    assertAeadKey(key2);
    const encrypted = encryptWebhookPayload("test", key1);
    expect(() => decryptWebhookPayload(encrypted, key2)).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const key = makeTestKey();
    const encrypted = encryptWebhookPayload("test", key);
    // Flip a byte in the ciphertext portion (after the nonce)
    const TAMPER_OFFSET = 25;
    encrypted[TAMPER_OFFSET] = (encrypted[TAMPER_OFFSET] ?? 0) ^ 0xff;
    expect(() => decryptWebhookPayload(encrypted, key)).toThrow();
  });

  it("throws on truncated input", () => {
    const key = makeTestKey();
    const tooShort = new Uint8Array(10);
    expect(() => decryptWebhookPayload(tooShort, key)).toThrow("too short");
  });
});
