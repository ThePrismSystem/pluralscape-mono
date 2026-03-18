import { describe, expect, it } from "vitest";

import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  RegenerateRecoveryKeySchema,
  RegistrationInputSchema,
} from "../auth.js";
import { AUTH_MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "../validation.constants.js";

// ── RegistrationInputSchema ──────────────────────────────────────────

describe("RegistrationInputSchema", () => {
  it("rejects password shorter than AUTH_MIN_PASSWORD_LENGTH", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "1234567", // 7 chars, below the 8-char minimum
      recoveryKeyBackupConfirmed: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["password"]);
    }
  });

  it("accepts password at exactly AUTH_MIN_PASSWORD_LENGTH", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "12345678", // exactly 8 chars
      recoveryKeyBackupConfirmed: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects password exceeding MAX_PASSWORD_LENGTH", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "a".repeat(MAX_PASSWORD_LENGTH + 1),
      recoveryKeyBackupConfirmed: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["password"]);
    }
  });

  it("accepts password at exactly MAX_PASSWORD_LENGTH", () => {
    const result = RegistrationInputSchema.safeParse({
      email: "user@example.com",
      password: "a".repeat(MAX_PASSWORD_LENGTH),
      recoveryKeyBackupConfirmed: true,
    });
    expect(result.success).toBe(true);
  });
});

// ── ChangeEmailSchema ───────────────────────────────────────────────

describe("ChangeEmailSchema", () => {
  it("parses valid input", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "user@example.com",
      currentPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "not-an-email",
      currentPassword: "password123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["email"]);
    }
  });

  it("rejects missing email", () => {
    const result = ChangeEmailSchema.safeParse({
      currentPassword: "password123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["email"]);
    }
  });

  it("rejects empty currentPassword", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "user@example.com",
      currentPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["currentPassword"]);
    }
  });

  it("strips unknown properties", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "user@example.com",
      currentPassword: "password123",
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "user@example.com",
        currentPassword: "password123",
      });
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── ChangePasswordSchema ────────────────────────────────────────────

describe("ChangePasswordSchema", () => {
  it("parses valid input", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty currentPassword", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "newpassword123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["currentPassword"]);
    }
  });

  it("rejects empty newPassword", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newPassword"]);
    }
  });

  it("rejects missing fields", () => {
    const result = ChangePasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it(`rejects newPassword shorter than ${String(AUTH_MIN_PASSWORD_LENGTH)} characters`, () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newPassword"]);
    }
  });

  it("rejects newPassword exceeding MAX_PASSWORD_LENGTH", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "a".repeat(MAX_PASSWORD_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newPassword"]);
    }
  });

  it("accepts newPassword at exactly MAX_PASSWORD_LENGTH", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "a".repeat(MAX_PASSWORD_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("strips unknown properties", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      });
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── RegenerateRecoveryKeySchema ─────────────────────────────────────

describe("RegenerateRecoveryKeySchema", () => {
  it("parses valid input", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "password123",
      confirmed: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        currentPassword: "password123",
        confirmed: true,
      });
    }
  });

  it("rejects when confirmed is false", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "password123",
      confirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects empty currentPassword", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "",
      confirmed: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["currentPassword"]);
    }
  });

  it("rejects missing confirmed", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "password123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects non-boolean confirmed", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "password123",
      confirmed: "true",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects missing fields", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      currentPassword: "password123",
      confirmed: true,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        currentPassword: "password123",
        confirmed: true,
      });
      expect("admin" in result.data).toBe(false);
    }
  });
});
