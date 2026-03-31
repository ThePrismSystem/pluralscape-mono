import {
  PWHASH_SALT_BYTES,
  derivePasswordKey,
  generateSalt,
  getSodium,
  hashPassword,
  unwrapMasterKey,
  verifyPassword,
  wrapMasterKey,
} from "@pluralscape/crypto";
import { accounts, sessions, systems } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  UpdateAccountSettingsSchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { hashEmail } from "../lib/email-hash.js";
import {
  deserializeEncryptedPayload,
  serializeEncryptedPayload,
} from "../lib/encrypted-payload.js";
import { fromHex, toHex } from "../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { EMAIL_CHANGE_FAILED_ERROR } from "../routes/account/account.constants.js";
import { EMAIL_SALT_BYTES } from "../routes/auth/auth.constants.js";

import { INCORRECT_PASSWORD_ERROR } from "./auth.constants.js";
import { isDuplicateEmailError, ValidationError } from "./auth.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AeadKey, KdfMasterKey, PwhashSalt } from "@pluralscape/crypto";
import type { AccountId, AccountType, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Get Account Info ──────────────────────────────────────────────

export interface AccountInfo {
  readonly accountId: AccountId;
  readonly accountType: AccountType;
  readonly systemId: SystemId | null;
  readonly auditLogIpTracking: boolean;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export async function getAccountInfo(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<AccountInfo | null> {
  return withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        accountId: accounts.id,
        accountType: accounts.accountType,
        auditLogIpTracking: accounts.auditLogIpTracking,
        version: accounts.version,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!row) return null;

    let systemId: SystemId | null = null;
    if (row.accountType === "system") {
      const [system] = await tx
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.accountId, accountId))
        .limit(1);
      systemId = system ? (system.id as SystemId) : null;
    }

    return {
      accountId: row.accountId as AccountId,
      accountType: row.accountType,
      systemId,
      auditLogIpTracking: row.auditLogIpTracking,
      version: row.version,
      createdAt: toUnixMillis(row.createdAt),
      updatedAt: toUnixMillis(row.updatedAt),
    };
  });
}

// ── Change Email ──────────────────────────────────────────────────

export async function changeEmail(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<{ ok: true }> {
  const parsed = ChangeEmailSchema.parse(params);

  const account = await withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        passwordHash: accounts.passwordHash,
        emailHash: accounts.emailHash,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  });

  if (!account) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const valid = verifyPassword(account.passwordHash, parsed.currentPassword);
  if (!valid) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const newEmailHash = hashEmail(parsed.email);
  if (newEmailHash === account.emailHash) {
    return { ok: true };
  }

  const adapter = getSodium();
  /** Stored for potential future per-account salting; current hashEmail() uses global pepper. */
  const newEmailSalt = toHex(adapter.randomBytes(EMAIL_SALT_BYTES));
  const timestamp = now();

  try {
    await withAccountTransaction(db, accountId, async (tx) => {
      const updated = await tx
        .update(accounts)
        .set({
          emailHash: newEmailHash,
          emailSalt: newEmailSalt,
          updatedAt: timestamp,
          version: account.version + 1,
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.version, account.version)))
        .returning({ id: accounts.id });

      if (updated.length === 0) {
        throw new ConcurrencyError("Account was modified concurrently");
      }

      await audit(tx, {
        eventType: "auth.email-changed",
        actor: { kind: "account", id: accountId },
        detail: "Email changed",
      });
    });
  } catch (error: unknown) {
    if (isDuplicateEmailError(error)) {
      throw new ValidationError(EMAIL_CHANGE_FAILED_ERROR);
    }
    throw error;
  }

  return { ok: true };
}

// ── Change Password ───────────────────────────────────────────────

export interface ChangePasswordResult {
  readonly ok: true;
  readonly revokedSessionCount: number;
  readonly sessionRevoked: boolean;
}

export async function changePassword(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<ChangePasswordResult> {
  const parsed = ChangePasswordSchema.parse(params);

  const account = await withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        passwordHash: accounts.passwordHash,
        kdfSalt: accounts.kdfSalt,
        encryptedMasterKey: accounts.encryptedMasterKey,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  });

  if (!account) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const valid = verifyPassword(account.passwordHash, parsed.currentPassword);
  if (!valid) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const adapter = getSodium();
  let oldKek: AeadKey | undefined;
  let masterKey: KdfMasterKey | undefined;
  let newKek: AeadKey | undefined;

  try {
    // Deserialize stored encrypted master key
    const encMasterKeyBytes = account.encryptedMasterKey;
    if (!encMasterKeyBytes) {
      throw new Error("Account missing encrypted master key");
    }
    const payload = deserializeEncryptedPayload(
      encMasterKeyBytes instanceof Uint8Array
        ? encMasterKeyBytes
        : new Uint8Array(encMasterKeyBytes),
    );

    // Derive old KEK and unwrap master key
    const oldSalt = fromHex(account.kdfSalt);
    if (oldSalt.length !== PWHASH_SALT_BYTES) {
      throw new Error("Stored KDF salt has invalid length");
    }
    oldKek = await derivePasswordKey(parsed.currentPassword, oldSalt as PwhashSalt, "server");
    masterKey = unwrapMasterKey(payload, oldKek);

    // Generate new salt, derive new KEK, re-wrap master key
    const newSalt = generateSalt();
    newKek = await derivePasswordKey(parsed.newPassword, newSalt, "server");
    const newWrapped = wrapMasterKey(masterKey, newKek);
    const newPasswordHash = hashPassword(parsed.newPassword, "server");
    const newEncMasterKeyBytes = serializeEncryptedPayload(newWrapped);
    const newKdfSaltHex = toHex(newSalt);

    const timestamp = now();

    const revokedSessionCount = await withAccountTransaction(db, accountId, async (tx) => {
      const updated = await tx
        .update(accounts)
        .set({
          passwordHash: newPasswordHash,
          kdfSalt: newKdfSaltHex,
          encryptedMasterKey: newEncMasterKeyBytes,
          updatedAt: timestamp,
          version: account.version + 1,
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.version, account.version)))
        .returning({ id: accounts.id });

      if (updated.length === 0) {
        throw new ConcurrencyError("Account was modified concurrently");
      }

      // Revoke ALL sessions (forces re-auth on every device)
      const revoked = await tx
        .update(sessions)
        .set({ revoked: true })
        .where(and(eq(sessions.accountId, accountId), eq(sessions.revoked, false)))
        .returning({ id: sessions.id });

      await audit(tx, {
        eventType: "auth.password-changed",
        actor: { kind: "account", id: accountId },
        detail: `Password changed, all ${String(revoked.length)} sessions revoked`,
      });

      return revoked.length;
    });

    return { ok: true, revokedSessionCount, sessionRevoked: revokedSessionCount > 0 };
  } finally {
    if (oldKek) adapter.memzero(oldKek);
    if (masterKey) adapter.memzero(masterKey);
    if (newKek) adapter.memzero(newKek);
  }
}

// ── Update Account Settings ──────────────────────────────────────

export interface UpdateAccountSettingsResult {
  readonly ok: true;
  readonly auditLogIpTracking: boolean;
  readonly version: number;
}

export async function updateAccountSettings(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<UpdateAccountSettingsResult> {
  const parsed = UpdateAccountSettingsSchema.parse(params);

  const timestamp = now();

  const updated = await withAccountTransaction(db, accountId, async (tx) => {
    const [row] = await tx
      .update(accounts)
      .set({
        auditLogIpTracking: parsed.auditLogIpTracking,
        updatedAt: timestamp,
        version: parsed.version + 1,
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.version, parsed.version)))
      .returning({
        auditLogIpTracking: accounts.auditLogIpTracking,
        version: accounts.version,
      });

    if (!row) {
      throw new ConcurrencyError("Account was modified concurrently");
    }

    const detail = parsed.auditLogIpTracking
      ? "Audit log IP tracking enabled"
      : "Audit log IP tracking disabled";

    await audit(tx, {
      eventType: "settings.changed",
      actor: { kind: "account", id: accountId },
      detail,
      overrideTrackIp: parsed.auditLogIpTracking,
    });

    return row;
  });

  return {
    ok: true,
    auditLogIpTracking: updated.auditLogIpTracking,
    version: updated.version,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

export class ConcurrencyError extends Error {
  override readonly name = "ConcurrencyError" as const;
}
