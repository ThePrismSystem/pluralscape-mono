import { describe, expect, it } from "vitest";

import { ChangeEmailSchema, ChangePasswordSchema } from "../auth.js";
import { AUTH_MIN_PASSWORD_LENGTH } from "../validation.constants.js";

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
