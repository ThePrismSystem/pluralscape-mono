import { initSodium } from "@pluralscape/crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getEmailHashPepper, hashEmail } from "../../lib/email-hash.js";

beforeAll(async () => {
  await initSodium();
});

describe("getEmailHashPepper", () => {
  const originalPepper = process.env["EMAIL_HASH_PEPPER"];

  afterEach(() => {
    if (originalPepper === undefined) {
      delete process.env["EMAIL_HASH_PEPPER"];
    } else {
      process.env["EMAIL_HASH_PEPPER"] = originalPepper;
    }
  });

  it("throws when EMAIL_HASH_PEPPER is not set", () => {
    delete process.env["EMAIL_HASH_PEPPER"];
    expect(() => getEmailHashPepper()).toThrow(
      "EMAIL_HASH_PEPPER environment variable is required",
    );
  });

  it("throws when EMAIL_HASH_PEPPER is empty string", () => {
    process.env["EMAIL_HASH_PEPPER"] = "";
    expect(() => getEmailHashPepper()).toThrow(
      "EMAIL_HASH_PEPPER environment variable is required",
    );
  });

  it("returns correct bytes for valid hex", () => {
    process.env["EMAIL_HASH_PEPPER"] = "deadbeef";
    const result = getEmailHashPepper();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBe(0xde);
    expect(result[1]).toBe(0xad);
    expect(result[2]).toBe(0xbe);
    expect(result[3]).toBe(0xef);
  });

  it("throws for invalid hex characters", () => {
    process.env["EMAIL_HASH_PEPPER"] = "zzzzzzzz";
    expect(() => getEmailHashPepper()).toThrow("EMAIL_HASH_PEPPER must be a valid hex string");
  });
});

describe("hashEmail", () => {
  const originalPepper = process.env["EMAIL_HASH_PEPPER"];

  beforeEach(() => {
    process.env["EMAIL_HASH_PEPPER"] = "a".repeat(64); // 32 bytes of 0xaa
  });

  afterEach(() => {
    if (originalPepper === undefined) {
      delete process.env["EMAIL_HASH_PEPPER"];
    } else {
      process.env["EMAIL_HASH_PEPPER"] = originalPepper;
    }
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
