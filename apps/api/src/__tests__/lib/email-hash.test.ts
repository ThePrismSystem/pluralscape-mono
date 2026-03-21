import { initSodium } from "@pluralscape/crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getEmailHashPepper, hashEmail } from "../../lib/email-hash.js";

const mockEnv = vi.hoisted(() => ({
  EMAIL_HASH_PEPPER: undefined as string | undefined,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

beforeAll(async () => {
  await initSodium();
});

describe("getEmailHashPepper", () => {
  afterEach(() => {
    mockEnv.EMAIL_HASH_PEPPER = undefined;
  });

  it("throws when EMAIL_HASH_PEPPER is not set", () => {
    mockEnv.EMAIL_HASH_PEPPER = undefined;
    expect(() => getEmailHashPepper()).toThrow(
      "EMAIL_HASH_PEPPER environment variable is required",
    );
  });

  it("throws when EMAIL_HASH_PEPPER is empty string", () => {
    mockEnv.EMAIL_HASH_PEPPER = "";
    expect(() => getEmailHashPepper()).toThrow(
      "EMAIL_HASH_PEPPER environment variable is required",
    );
  });

  it("returns correct bytes for valid 64-char hex", () => {
    // 64 hex chars = 32 bytes
    mockEnv.EMAIL_HASH_PEPPER = "deadbeef".repeat(8);
    const result = getEmailHashPepper();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
    expect(result[0]).toBe(0xde);
    expect(result[1]).toBe(0xad);
    expect(result[2]).toBe(0xbe);
    expect(result[3]).toBe(0xef);
  });

  it("throws for wrong-length hex (not 64 chars)", () => {
    mockEnv.EMAIL_HASH_PEPPER = "deadbeef";
    expect(() => getEmailHashPepper()).toThrow("64-character hex string");
  });

  it("throws for odd-length hex string", () => {
    mockEnv.EMAIL_HASH_PEPPER = "a".repeat(63);
    expect(() => getEmailHashPepper()).toThrow("64-character hex string");
  });

  it("throws for invalid hex characters", () => {
    mockEnv.EMAIL_HASH_PEPPER = "z".repeat(64);
    expect(() => getEmailHashPepper()).toThrow("Invalid hex string");
  });
});

describe("hashEmail", () => {
  beforeEach(() => {
    mockEnv.EMAIL_HASH_PEPPER = "a".repeat(64); // 32 bytes of 0xaa
  });

  afterEach(() => {
    mockEnv.EMAIL_HASH_PEPPER = undefined;
  });

  it("returns a 64-character hex string", () => {
    const result = hashEmail("user@example.com");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same email", () => {
    const hash1 = hashEmail("user@example.com");
    const hash2 = hashEmail("user@example.com");
    expect(hash1).toBe(hash2);
  });

  it("is case-insensitive", () => {
    const lower = hashEmail("user@example.com");
    const upper = hashEmail("USER@EXAMPLE.COM");
    const mixed = hashEmail("User@Example.COM");
    expect(lower).toBe(upper);
    expect(lower).toBe(mixed);
  });

  it("produces different hashes for different emails", () => {
    const hash1 = hashEmail("alice@example.com");
    const hash2 = hashEmail("bob@example.com");
    expect(hash1).not.toBe(hash2);
  });
});
