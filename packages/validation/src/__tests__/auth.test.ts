import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  LoginSchema,
  PasswordResetViaRecoveryKeySchema,
  RegenerateRecoveryKeySchema,
  RegistrationCommitSchema,
  RegistrationInitiateSchema,
  SaltFetchSchema,
  UpdateAccountSettingsSchema,
} from "../auth.js";

import type { z } from "zod/v4";

// Valid hex strings of required lengths
const AUTH_KEY = "a".repeat(64); // 32 bytes → 64 hex chars
const KDF_SALT = "b".repeat(32); // 16 bytes → 32 hex chars
const CHALLENGE_SIG = "c".repeat(128); // 64 bytes → 128 hex chars
const RECOVERY_KEY_HASH = "d".repeat(64); // 32 bytes → 64 hex chars
// Encrypted blob: min 40 bytes → 80 hex chars (nonce 24B + tag 16B overhead)
const BLOB = "e".repeat(80);

// ── RegistrationInitiateSchema ────────────────────────────────────────

describe("RegistrationInitiateSchema", () => {
  it("accepts valid email", () => {
    const result = RegistrationInitiateSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("defaults accountType to system", () => {
    const result = RegistrationInitiateSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountType).toBe("system");
    }
  });

  it("accepts accountType viewer", () => {
    const result = RegistrationInitiateSchema.safeParse({
      email: "user@example.com",
      accountType: "viewer",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountType).toBe("viewer");
    }
  });

  it("rejects invalid email", () => {
    const result = RegistrationInitiateSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects missing email", () => {
    const result = RegistrationInitiateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── RegistrationCommitSchema ──────────────────────────────────────────

describe("RegistrationCommitSchema", () => {
  const valid = {
    accountId: "acct_123",
    authKey: AUTH_KEY,
    encryptedMasterKey: BLOB,
    encryptedSigningPrivateKey: BLOB,
    encryptedEncryptionPrivateKey: BLOB,
    publicSigningKey: "a".repeat(64),
    publicEncryptionKey: "b".repeat(64),
    recoveryEncryptedMasterKey: BLOB,
    challengeSignature: CHALLENGE_SIG,
    recoveryKeyBackupConfirmed: true,
    recoveryKeyHash: RECOVERY_KEY_HASH,
  };

  it("accepts valid input", () => {
    expect(RegistrationCommitSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects authKey of wrong length", () => {
    const result = RegistrationCommitSchema.safeParse({ ...valid, authKey: "a".repeat(62) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("rejects non-hex authKey", () => {
    const result = RegistrationCommitSchema.safeParse({ ...valid, authKey: "z".repeat(64) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("rejects challengeSignature of wrong length", () => {
    const result = RegistrationCommitSchema.safeParse({
      ...valid,
      challengeSignature: "c".repeat(64),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["challengeSignature"]);
    }
  });

  it("rejects empty encryptedMasterKey", () => {
    const result = RegistrationCommitSchema.safeParse({ ...valid, encryptedMasterKey: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["encryptedMasterKey"]);
    }
  });

  it("rejects encryptedMasterKey that is too short", () => {
    const result = RegistrationCommitSchema.safeParse({ ...valid, encryptedMasterKey: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["encryptedMasterKey"]);
    }
  });

  it("rejects missing accountId", () => {
    const result = RegistrationCommitSchema.safeParse({
      authKey: valid.authKey,
      encryptedMasterKey: valid.encryptedMasterKey,
      encryptedSigningPrivateKey: valid.encryptedSigningPrivateKey,
      encryptedEncryptionPrivateKey: valid.encryptedEncryptionPrivateKey,
      publicSigningKey: valid.publicSigningKey,
      publicEncryptionKey: valid.publicEncryptionKey,
      recoveryEncryptedMasterKey: valid.recoveryEncryptedMasterKey,
      challengeSignature: valid.challengeSignature,
      recoveryKeyBackupConfirmed: valid.recoveryKeyBackupConfirmed,
    });
    expect(result.success).toBe(false);
  });
});

// ── SaltFetchSchema ───────────────────────────────────────────────────

describe("SaltFetchSchema", () => {
  it("accepts valid email", () => {
    expect(SaltFetchSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = SaltFetchSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });
});

// ── LoginSchema ───────────────────────────────────────────────────────

describe("LoginSchema", () => {
  it("accepts valid email and authKey", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com", authKey: AUTH_KEY });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({ email: "not-an-email", authKey: AUTH_KEY });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects authKey of wrong length", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com", authKey: "a".repeat(32) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("rejects non-hex authKey", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      authKey: "z".repeat(64),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("rejects missing authKey", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      authKey: AUTH_KEY,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── ChangeEmailSchema ─────────────────────────────────────────────────

describe("ChangeEmailSchema", () => {
  it("accepts valid input", () => {
    const result = ChangeEmailSchema.safeParse({ email: "new@example.com", authKey: AUTH_KEY });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = ChangeEmailSchema.safeParse({ email: "not-an-email", authKey: AUTH_KEY });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects missing email", () => {
    const result = ChangeEmailSchema.safeParse({ authKey: AUTH_KEY });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects authKey of wrong length", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "new@example.com",
      authKey: "a".repeat(32),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("strips unknown properties", () => {
    const result = ChangeEmailSchema.safeParse({
      email: "new@example.com",
      authKey: AUTH_KEY,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── ChangePasswordSchema ──────────────────────────────────────────────

describe("ChangePasswordSchema", () => {
  const valid = {
    oldAuthKey: AUTH_KEY,
    newAuthKey: AUTH_KEY,
    newKdfSalt: KDF_SALT,
    newEncryptedMasterKey: BLOB,
    challengeSignature: CHALLENGE_SIG,
  };

  it("accepts valid input", () => {
    expect(ChangePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects oldAuthKey of wrong length", () => {
    const result = ChangePasswordSchema.safeParse({ ...valid, oldAuthKey: "a".repeat(32) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["oldAuthKey"]);
    }
  });

  it("rejects newAuthKey of wrong length", () => {
    const result = ChangePasswordSchema.safeParse({ ...valid, newAuthKey: "a".repeat(32) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newAuthKey"]);
    }
  });

  it("rejects newKdfSalt of wrong length", () => {
    const result = ChangePasswordSchema.safeParse({ ...valid, newKdfSalt: "b".repeat(16) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newKdfSalt"]);
    }
  });

  it("rejects non-hex challengeSignature", () => {
    const result = ChangePasswordSchema.safeParse({
      ...valid,
      challengeSignature: "z".repeat(128),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["challengeSignature"]);
    }
  });

  it("rejects empty newEncryptedMasterKey", () => {
    const result = ChangePasswordSchema.safeParse({ ...valid, newEncryptedMasterKey: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newEncryptedMasterKey"]);
    }
  });

  it("rejects missing fields", () => {
    expect(ChangePasswordSchema.safeParse({}).success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = ChangePasswordSchema.safeParse({ ...valid, admin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── RegenerateRecoveryKeySchema ───────────────────────────────────────

describe("RegenerateRecoveryKeySchema", () => {
  const valid = {
    authKey: AUTH_KEY,
    newRecoveryEncryptedMasterKey: BLOB,
    recoveryKeyHash: RECOVERY_KEY_HASH,
    confirmed: true as const,
  };

  it("accepts valid input", () => {
    expect(RegenerateRecoveryKeySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects when confirmed is false", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({ ...valid, confirmed: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects authKey of wrong length", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({ ...valid, authKey: "a".repeat(32) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["authKey"]);
    }
  });

  it("rejects recoveryKeyHash of wrong length", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      ...valid,
      recoveryKeyHash: "d".repeat(32),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["recoveryKeyHash"]);
    }
  });

  it("rejects non-hex recoveryKeyHash", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      ...valid,
      recoveryKeyHash: "z".repeat(64),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["recoveryKeyHash"]);
    }
  });

  it("rejects missing confirmed", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({
      authKey: valid.authKey,
      newRecoveryEncryptedMasterKey: valid.newRecoveryEncryptedMasterKey,
      recoveryKeyHash: valid.recoveryKeyHash,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects non-boolean confirmed", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({ ...valid, confirmed: "true" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmed"]);
    }
  });

  it("rejects missing fields", () => {
    expect(RegenerateRecoveryKeySchema.safeParse({}).success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = RegenerateRecoveryKeySchema.safeParse({ ...valid, admin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── PasswordResetViaRecoveryKeySchema ─────────────────────────────────

describe("PasswordResetViaRecoveryKeySchema", () => {
  const valid = {
    email: "user@example.com",
    newAuthKey: AUTH_KEY,
    newKdfSalt: KDF_SALT,
    newEncryptedMasterKey: BLOB,
    newRecoveryEncryptedMasterKey: BLOB,
    recoveryKeyHash: RECOVERY_KEY_HASH,
    newRecoveryKeyHash: RECOVERY_KEY_HASH,
  };

  it("accepts valid input", () => {
    expect(PasswordResetViaRecoveryKeySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects newAuthKey of wrong length", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({
      ...valid,
      newAuthKey: "a".repeat(32),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newAuthKey"]);
    }
  });

  it("rejects newKdfSalt of wrong length", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({
      ...valid,
      newKdfSalt: "b".repeat(16),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newKdfSalt"]);
    }
  });

  it("rejects non-hex newRecoveryKeyHash", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({
      ...valid,
      newRecoveryKeyHash: "z".repeat(64),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newRecoveryKeyHash"]);
    }
  });

  it("rejects empty newEncryptedMasterKey", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({
      ...valid,
      newEncryptedMasterKey: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["newEncryptedMasterKey"]);
    }
  });

  it("rejects recoveryKeyHash of wrong length", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({
      ...valid,
      recoveryKeyHash: "d".repeat(32),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["recoveryKeyHash"]);
    }
  });

  it("rejects missing fields", () => {
    expect(PasswordResetViaRecoveryKeySchema.safeParse({}).success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = PasswordResetViaRecoveryKeySchema.safeParse({ ...valid, admin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── UpdateAccountSettingsSchema ──────────────────────────────────────

describe("UpdateAccountSettingsSchema", () => {
  it("parses valid input", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: true,
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing auditLogIpTracking", () => {
    const result = UpdateAccountSettingsSchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["auditLogIpTracking"]);
    }
  });

  it("rejects missing version", () => {
    const result = UpdateAccountSettingsSchema.safeParse({ auditLogIpTracking: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["version"]);
    }
  });

  it("rejects non-boolean auditLogIpTracking", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: "true",
      version: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["auditLogIpTracking"]);
    }
  });

  it("rejects non-integer version", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: true,
      version: 1.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["version"]);
    }
  });

  it("rejects negative version", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: true,
      version: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["version"]);
    }
  });

  it("rejects version zero", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: true,
      version: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["version"]);
    }
  });

  it("strips unknown properties", () => {
    const result = UpdateAccountSettingsSchema.safeParse({
      auditLogIpTracking: false,
      version: 1,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ auditLogIpTracking: false, version: 1 });
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── Type-level parity for inferred request inputs ─────────────────────
// Guards the canonical chain after the hand-rolled `LoginCredentials`
// interface was retired (G8 strict — see ADR-023).

describe("LoginSchema (z.infer parity)", () => {
  type LoginCredentials = z.infer<typeof LoginSchema>;

  it("has no id or timestamps", () => {
    expectTypeOf<LoginCredentials>().not.toHaveProperty("id");
    expectTypeOf<LoginCredentials>().not.toHaveProperty("createdAt");
  });

  it("has expected fields", () => {
    expectTypeOf<LoginCredentials["email"]>().toEqualTypeOf<string>();
    expectTypeOf<LoginCredentials["authKey"]>().toEqualTypeOf<string>();
  });
});
