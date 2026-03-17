import { describe, expect, expectTypeOf, it } from "vitest";

import { LoginCredentialsSchema, RegistrationInputSchema } from "../auth.js";

import type { LoginCredentials, RegistrationInput } from "@pluralscape/types";
import type { z } from "zod/v4";

// ── Compile-time contract tests ──────────────────────────────────────
// These verify that z.infer<Schema> is assignable to/from the canonical type.
// A schema that drifts from the TypeScript interface will cause a type error here.

describe("LoginCredentials contract", () => {
  it("schema infers the correct type (compile-time)", () => {
    expectTypeOf<z.infer<typeof LoginCredentialsSchema>>().toEqualTypeOf<LoginCredentials>();
  });

  it("parses a valid LoginCredentials value (runtime)", () => {
    const input: LoginCredentials = { email: "user@example.com", password: "hunter2!" };
    const result = LoginCredentialsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = LoginCredentialsSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["email"]);
    }
  });

  it("rejects a missing password", () => {
    const result = LoginCredentialsSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["password"]);
    }
  });

  it("strips unknown properties", () => {
    const result = LoginCredentialsSchema.safeParse({
      email: "user@example.com",
      password: "hunter2!",
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "user@example.com", password: "hunter2!" });
      expect("admin" in result.data).toBe(false);
    }
  });
});

describe("RegistrationInput contract", () => {
  it("schema infers the correct type (compile-time)", () => {
    expectTypeOf<z.infer<typeof RegistrationInputSchema>>().toEqualTypeOf<RegistrationInput>();
  });

  it("parses a valid RegistrationInput value (runtime)", () => {
    const input: RegistrationInput = {
      email: "user@example.com",
      password: "hunter2!",
      recoveryKeyBackupConfirmed: true,
      accountType: "system",
    };
    const result = RegistrationInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts recoveryKeyBackupConfirmed as false", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "hunter2!",
      recoveryKeyBackupConfirmed: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recoveryKeyBackupConfirmed).toBe(false);
    }
  });

  it("rejects missing recoveryKeyBackupConfirmed", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "hunter2!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["recoveryKeyBackupConfirmed"]);
    }
  });

  it("strips unknown properties", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "hunter2!",
      recoveryKeyBackupConfirmed: true,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "user@example.com",
        password: "hunter2!",
        recoveryKeyBackupConfirmed: true,
        accountType: "system",
      });
      expect("admin" in result.data).toBe(false);
    }
  });
});
