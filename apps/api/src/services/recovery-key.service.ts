import { hashAuthKey, verifyAuthKey, verifyRecoveryKey } from "@pluralscape/crypto";
import { accounts, recoveryKeys, sessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, SESSION_TIMEOUTS, createId, now, toUnixMillis } from "@pluralscape/types";
import {
  PasswordResetViaRecoveryKeySchema,
  RegenerateRecoveryKeySchema,
} from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../lib/anti-enum-timing.js";
import { ensureUint8Array } from "../lib/binary.js";
import { hashEmail } from "../lib/email-hash.js";
import { fromHex } from "../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { generateSessionToken, hashSessionToken } from "../lib/session-token.js";

import { INCORRECT_PASSWORD_ERROR } from "./auth.constants.js";
import { ValidationError } from "./auth.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { ClientPlatform } from "../routes/auth/auth.constants.js";
import type { AccountId, SessionId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Recovery Key Status ──────────────────────────────────────────

export type RecoveryKeyStatus =
  | { readonly hasActiveKey: true; readonly createdAt: UnixMillis }
  | { readonly hasActiveKey: false; readonly createdAt: null };

export async function getRecoveryKeyStatus(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<RecoveryKeyStatus> {
  return withAccountRead(db, accountId, async (tx) => {
    const rows = await tx
      .select({
        id: recoveryKeys.id,
        createdAt: recoveryKeys.createdAt,
      })
      .from(recoveryKeys)
      .where(and(eq(recoveryKeys.accountId, accountId), isNull(recoveryKeys.revokedAt)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { hasActiveKey: false, createdAt: null };
    }
    return { hasActiveKey: true, createdAt: toUnixMillis(row.createdAt) };
  });
}

// ── Regenerate Recovery Key ──────────────────────────────────────

export interface RegenerateRecoveryKeyResult {
  readonly ok: true;
}

export async function regenerateRecoveryKeyBackup(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<RegenerateRecoveryKeyResult> {
  const parsed = RegenerateRecoveryKeySchema.parse(params);

  return withAccountTransaction(db, accountId, async (tx) => {
    const [account] = await tx
      .select({
        authKeyHash: accounts.authKeyHash,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new ValidationError(INCORRECT_PASSWORD_ERROR);
    }

    const storedHash = ensureUint8Array(account.authKeyHash);
    const valid = verifyAuthKey(fromHex(parsed.authKey), storedHash);
    if (!valid) {
      throw new ValidationError(INCORRECT_PASSWORD_ERROR);
    }

    // Look up active recovery key
    const activeRows = await tx
      .select({ id: recoveryKeys.id })
      .from(recoveryKeys)
      .where(and(eq(recoveryKeys.accountId, accountId), isNull(recoveryKeys.revokedAt)))
      .limit(1);

    const activeKey = activeRows[0];
    if (!activeKey) {
      throw new NoActiveRecoveryKeyError("No active recovery key to revoke");
    }

    const newRecoveryEncryptedMasterKeyBytes = fromHex(parsed.newRecoveryEncryptedMasterKey);
    const recoveryKeyHashBytes = fromHex(parsed.recoveryKeyHash);
    const timestamp = now();
    const newId = createId(ID_PREFIXES.recoveryKey);

    const revoked = await tx
      .update(recoveryKeys)
      .set({ revokedAt: timestamp })
      .where(and(eq(recoveryKeys.id, activeKey.id), isNull(recoveryKeys.revokedAt)))
      .returning({ id: recoveryKeys.id });

    if (revoked.length === 0) {
      throw new Error("Recovery key not found during revocation");
    }

    await tx.insert(recoveryKeys).values({
      id: newId,
      accountId,
      encryptedMasterKey: newRecoveryEncryptedMasterKeyBytes,
      recoveryKeyHash: recoveryKeyHashBytes,
      createdAt: timestamp,
    });

    await audit(tx, {
      eventType: "auth.recovery-key-regenerated",
      actor: { kind: "account", id: accountId },
      detail: "Recovery key regenerated",
    });

    return { ok: true as const };
  });
}

// ── Reset Password via Recovery Key ──────────────────────────────

export interface PasswordResetResult {
  readonly sessionToken: SessionId;
  readonly accountId: AccountId;
}

export async function resetPasswordWithRecoveryKey(
  db: PostgresJsDatabase,
  params: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
): Promise<PasswordResetResult | null> {
  const startTime = performance.now();
  const parsed = PasswordResetViaRecoveryKeySchema.parse(params);

  const emailHash = hashEmail(parsed.email);

  // Look up account by email hash
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  // Fetch active recovery key (account-scoped read)
  const activeKey = await withAccountRead(db, account.id as AccountId, async (tx) => {
    const [row] = await tx
      .select({ id: recoveryKeys.id, recoveryKeyHash: recoveryKeys.recoveryKeyHash })
      .from(recoveryKeys)
      .where(and(eq(recoveryKeys.accountId, account.id), isNull(recoveryKeys.revokedAt)))
      .limit(1);
    return row ?? null;
  });

  if (!activeKey) {
    await equalizeAntiEnumTiming(startTime);
    throw new NoActiveRecoveryKeyError("No active recovery key found");
  }

  // Verify recovery key hash — reject if no hash stored or hash doesn't match
  if (!activeKey.recoveryKeyHash) {
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  const storedRecoveryHash = ensureUint8Array(activeKey.recoveryKeyHash);
  const recoveryKeyValid = verifyRecoveryKey(
    fromHex(parsed.newRecoveryKeyHash),
    storedRecoveryHash,
  );
  if (!recoveryKeyValid) {
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  try {
    const newAuthKeyHash = hashAuthKey(fromHex(parsed.newAuthKey));
    const newEncryptedMasterKeyBytes = fromHex(parsed.newEncryptedMasterKey);
    const newRecoveryEncryptedMasterKeyBytes = fromHex(parsed.newRecoveryEncryptedMasterKey);

    const timestamp = now();
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const sessionId = createId(ID_PREFIXES.session);
    const newRecoveryKeyId = createId(ID_PREFIXES.recoveryKey);
    const timeouts = SESSION_TIMEOUTS[platform];
    const expiresAt = timestamp + timeouts.absoluteTtlMs;

    await withAccountTransaction(db, account.id as AccountId, async (tx) => {
      // Update account: new auth key hash, KDF salt, encrypted master key
      await tx
        .update(accounts)
        .set({
          authKeyHash: newAuthKeyHash,
          kdfSalt: parsed.newKdfSalt,
          encryptedMasterKey: newEncryptedMasterKeyBytes,
          updatedAt: timestamp,
        })
        .where(eq(accounts.id, account.id));

      // Revoke old recovery key (TOCTOU guard)
      const revoked = await tx
        .update(recoveryKeys)
        .set({ revokedAt: timestamp })
        .where(and(eq(recoveryKeys.id, activeKey.id), isNull(recoveryKeys.revokedAt)))
        .returning({ id: recoveryKeys.id });

      if (revoked.length === 0) {
        throw new Error("Recovery key not found during revocation");
      }

      // Insert new recovery key
      await tx.insert(recoveryKeys).values({
        id: newRecoveryKeyId,
        accountId: account.id,
        encryptedMasterKey: newRecoveryEncryptedMasterKeyBytes,
        createdAt: timestamp,
      });

      // Revoke all existing sessions
      await tx
        .update(sessions)
        .set({ revoked: true })
        .where(and(eq(sessions.accountId, account.id), eq(sessions.revoked, false)));

      // Create new session
      await tx.insert(sessions).values({
        id: sessionId,
        tokenHash,
        accountId: account.id,
        createdAt: timestamp,
        lastActive: timestamp,
        expiresAt,
      });

      await audit(tx, {
        eventType: "auth.password-reset-via-recovery",
        actor: { kind: "account", id: account.id },
        detail: "Password reset via recovery key",
        accountId: account.id as AccountId,
      });
    });

    return {
      sessionToken: rawToken as SessionId,
      accountId: account.id as AccountId,
    };
  } finally {
    await equalizeAntiEnumTiming(startTime);
  }
}

// ── Errors ───────────────────────────────────────────────────────

class NoActiveRecoveryKeyError extends Error {
  override readonly name = "NoActiveRecoveryKeyError" as const;
}

export { NoActiveRecoveryKeyError };
