import { describe, expect, expectTypeOf, it } from "vitest";

import { LoginSchema, RegistrationCommitSchema, RegistrationInitiateSchema } from "../auth.js";

import type { z } from "zod/v4";

// ── Compile-time contract tests ──────────────────────────────────────
// Verify that z.infer produces the expected structural shape.

describe("LoginSchema contract", () => {
  it("infers email and authKey string fields", () => {
    expectTypeOf<z.infer<typeof LoginSchema>["email"]>().toEqualTypeOf<string>();
    expectTypeOf<z.infer<typeof LoginSchema>["authKey"]>().toEqualTypeOf<string>();
  });

  it("parses a valid login value (runtime)", () => {
    const input = { email: "user@example.com", authKey: "a".repeat(64) };
    const result = LoginSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = LoginSchema.safeParse({ email: "not-an-email", authKey: "a".repeat(64) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("strips unknown properties", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      authKey: "a".repeat(64),
      extra: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("extra" in result.data).toBe(false);
    }
  });
});

describe("RegistrationInitiateSchema contract", () => {
  it("infers email and accountType fields", () => {
    expectTypeOf<z.infer<typeof RegistrationInitiateSchema>["email"]>().toEqualTypeOf<string>();
    expectTypeOf<z.infer<typeof RegistrationInitiateSchema>["accountType"]>().toEqualTypeOf<
      "system" | "viewer"
    >();
  });

  it("parses a valid initiate value (runtime)", () => {
    const result = RegistrationInitiateSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountType).toBe("system");
    }
  });
});

describe("RegistrationCommitSchema contract", () => {
  it("infers accountId, authKey, and recoveryKeyBackupConfirmed fields", () => {
    expectTypeOf<z.infer<typeof RegistrationCommitSchema>["accountId"]>().toEqualTypeOf<string>();
    expectTypeOf<z.infer<typeof RegistrationCommitSchema>["authKey"]>().toEqualTypeOf<string>();
    expectTypeOf<
      z.infer<typeof RegistrationCommitSchema>["recoveryKeyBackupConfirmed"]
    >().toEqualTypeOf<boolean>();
  });

  it("parses a valid commit value (runtime)", () => {
    // Encrypted blob: min 40 bytes → 80 hex chars (nonce 24B + tag 16B overhead)
    const blob = "e".repeat(80);
    const input = {
      accountId: "acct_123",
      authKey: "a".repeat(64),
      encryptedMasterKey: blob,
      encryptedSigningPrivateKey: blob,
      encryptedEncryptionPrivateKey: blob,
      publicSigningKey: "a".repeat(64),
      publicEncryptionKey: "b".repeat(64),
      recoveryEncryptedMasterKey: blob,
      challengeSignature: "c".repeat(128),
      recoveryKeyBackupConfirmed: true,
      recoveryKeyHash: "d".repeat(64),
    };
    const result = RegistrationCommitSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
