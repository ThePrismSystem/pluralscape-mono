import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  assertAeadKey,
  initSodium,
} from "@pluralscape/crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => {
  const env: Record<string, string | undefined> = {};
  return env;
});
vi.mock("../../env.js", () => ({ env: mockEnv }));

import {
  decryptWebhookPayload,
  encryptWebhookPayload,
  getWebhookPayloadEncryptionKey,
} from "../../services/webhook-payload-encryption.js";

beforeAll(async () => {
  await initSodium();
});

afterEach(() => {
  delete mockEnv.WEBHOOK_PAYLOAD_ENCRYPTION_KEY;
});

function makeTestKey() {
  const key = new Uint8Array(32).fill(0xab);
  assertAeadKey(key);
  return key;
}

// -- getWebhookPayloadEncryptionKey -----------------------------------------

describe("getWebhookPayloadEncryptionKey", () => {
  it("throws when env var is not set", () => {
    delete mockEnv.WEBHOOK_PAYLOAD_ENCRYPTION_KEY;
    expect(() => getWebhookPayloadEncryptionKey()).toThrow(
      "WEBHOOK_PAYLOAD_ENCRYPTION_KEY is required",
    );
  });

  it("returns an AeadKey when env var is a valid 64-char hex string", () => {
    mockEnv.WEBHOOK_PAYLOAD_ENCRYPTION_KEY = "ab".repeat(AEAD_KEY_BYTES);
    const key = getWebhookPayloadEncryptionKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key).toHaveLength(AEAD_KEY_BYTES);
  });

  it("throws when env var has wrong length", () => {
    mockEnv.WEBHOOK_PAYLOAD_ENCRYPTION_KEY = "abcd";
    expect(() => getWebhookPayloadEncryptionKey()).toThrow("64-character hex string");
  });
});

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
