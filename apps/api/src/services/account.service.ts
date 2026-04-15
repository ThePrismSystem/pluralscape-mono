import { getSodium, hashAuthKey, verifyAuthKey } from "@pluralscape/crypto";
import { accounts, sessions, systems } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  UpdateAccountSettingsSchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { hashEmail } from "../lib/email-hash.js";
import { fromHex, toHex } from "../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { EMAIL_CHANGE_FAILED_ERROR } from "../routes/account/account.constants.js";
import { EMAIL_SALT_BYTES } from "../routes/auth/auth.constants.js";

import { INCORRECT_PASSWORD_ERROR } from "./auth.constants.js";
import { isDuplicateEmailError, ValidationError } from "./auth.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
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
        authKeyHash: accounts.authKeyHash,
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

  const authKeyHash =
    account.authKeyHash instanceof Uint8Array
      ? account.authKeyHash
      : new Uint8Array(account.authKeyHash);
  const valid = verifyAuthKey(fromHex(parsed.authKey), authKeyHash);
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
        authKeyHash: accounts.authKeyHash,
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

  const authKeyHash =
    account.authKeyHash instanceof Uint8Array
      ? account.authKeyHash
      : new Uint8Array(account.authKeyHash);
  const valid = verifyAuthKey(fromHex(parsed.oldAuthKey), authKeyHash);
  if (!valid) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  // Hash the new auth key (BLAKE2B) — server never sees the raw key again after this point
  const newAuthKeyHash = hashAuthKey(fromHex(parsed.newAuthKey));

  // Client sends the re-wrapped master key blob; server stores it opaquely
  const newEncMasterKeyBytes = fromHex(parsed.newEncryptedMasterKey);

  // TODO: verify challengeSignature against the account's stored signing public key
  // once per-account signing keys are persisted. The schema includes it so the client
  // always sends it; skip verification until signing keys are stored server-side.

  const timestamp = now();

  const revokedSessionCount = await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({
        authKeyHash: newAuthKeyHash,
        kdfSalt: parsed.newKdfSalt,
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
