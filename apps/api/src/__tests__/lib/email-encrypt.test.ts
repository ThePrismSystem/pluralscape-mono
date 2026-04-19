import { AEAD_NONCE_BYTES, initSodium } from "@pluralscape/crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { decryptEmail, encryptEmail, getEmailEncryptionKey } from "../../lib/email-encrypt.js";

const mockEnv = vi.hoisted(() => ({
  EMAIL_ENCRYPTION_KEY: undefined as string | undefined,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

/** Valid 64-char hex key (32 bytes of 0xaa). */
const VALID_KEY_HEX = "aa".repeat(32);

beforeAll(async () => {
  await initSodium();
});

describe("getEmailEncryptionKey", () => {
  afterEach(() => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
  });

  it("returns null when EMAIL_ENCRYPTION_KEY is not set", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
    expect(getEmailEncryptionKey()).toBeNull();
  });

  it("returns null when EMAIL_ENCRYPTION_KEY is empty string", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = "";
    expect(getEmailEncryptionKey()).toBeNull();
  });

  it("returns a Uint8Array for valid 64-char hex", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const result = getEmailEncryptionKey();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toHaveLength(32);
  });

  it("throws for wrong-length hex", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = "aa".repeat(16);
    expect(() => getEmailEncryptionKey()).toThrow("64-character hex string");
  });
});

describe("encryptEmail", () => {
  afterEach(() => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
  });

  it("throws when EMAIL_ENCRYPTION_KEY is not configured", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
    expect(() => encryptEmail("user@example.com")).toThrow(
      "EMAIL_ENCRYPTION_KEY is required for email encryption",
    );
  });

  it("returns a Uint8Array containing nonce + ciphertext", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const result = encryptEmail("user@example.com");
    expect(result).toBeInstanceOf(Uint8Array);
    // Must be at least nonce length + 1 byte of ciphertext + tag
    expect(result.length).toBeGreaterThan(AEAD_NONCE_BYTES);
  });

  it("produces different ciphertext on each call (random nonce)", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const a = encryptEmail("user@example.com");
    const b = encryptEmail("user@example.com");
    // Nonces should differ, so outputs should differ
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it("normalizes email before encryption (case-insensitive round-trip)", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const encrypted = encryptEmail("  USER@Example.COM  ");
    const decrypted = decryptEmail(encrypted);
    expect(decrypted).toBe("user@example.com");
  });
});

describe("decryptEmail", () => {
  afterEach(() => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
  });

  it("throws when EMAIL_ENCRYPTION_KEY is not configured", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
    const dummy = new Uint8Array(AEAD_NONCE_BYTES + 32);
    expect(() => decryptEmail(dummy)).toThrow(
      "EMAIL_ENCRYPTION_KEY is required for email decryption",
    );
  });

  it("throws for data too short to be valid", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const tooShort = new Uint8Array(AEAD_NONCE_BYTES);
    expect(() => decryptEmail(tooShort)).toThrow("too short");
  });

  it("throws for corrupted ciphertext", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const encrypted = encryptEmail("user@example.com");
    // Flip a byte in the ciphertext portion
    const corruptIndex = AEAD_NONCE_BYTES + 1;
    const original = encrypted[corruptIndex];
    if (original === undefined) throw new Error("expected byte at corruptIndex");
    encrypted[corruptIndex] = original ^ 0xff;
    expect(() => decryptEmail(encrypted)).toThrow();
  });

  it("round-trips correctly", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const email = "alice@example.com";
    const encrypted = encryptEmail(email);
    const decrypted = decryptEmail(encrypted);
    expect(decrypted).toBe(email);
  });

  it("round-trips with different keys producing decryption failure", () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;
    const encrypted = encryptEmail("user@example.com");

    // Switch to a different key
    mockEnv.EMAIL_ENCRYPTION_KEY = "bb".repeat(32);
    expect(() => decryptEmail(encrypted)).toThrow();
  });
});
