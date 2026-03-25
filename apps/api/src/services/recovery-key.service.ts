import {
  DecryptionFailedError,
  InvalidInputError,
  PWHASH_SALT_BYTES,
  derivePasswordKey,
  getSodium,
  hashPassword,
  regenerateRecoveryKey,
  resetPasswordViaRecoveryKey,
  serializeRecoveryBackup,
  unwrapMasterKey,
  verifyPassword,
} from "@pluralscape/crypto";
import { accounts, recoveryKeys, sessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, SESSION_TIMEOUTS, createId, now, toUnixMillis } from "@pluralscape/types";
import {
  PasswordResetViaRecoveryKeySchema,
  RegenerateRecoveryKeySchema,
} from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../lib/anti-enum-timing.js";
import { hashEmail } from "../lib/email-hash.js";
import {
  deserializeEncryptedPayload,
  serializeEncryptedPayload,
} from "../lib/encrypted-payload.js";
import { fromHex, toHex } from "../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { generateSessionToken, hashSessionToken } from "../lib/session-token.js";
import { DUMMY_ARGON2_HASH } from "../routes/auth/auth.constants.js";

import { INCORRECT_PASSWORD_ERROR } from "./auth.constants.js";
import { ValidationError } from "./auth.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AppLogger } from "../lib/logger.js";
import type { ClientPlatform } from "../routes/auth/auth.constants.js";
import type { AeadKey, KdfMasterKey, PwhashSalt, RecoveryKeyResult } from "@pluralscape/crypto";
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
  readonly recoveryKey: string;
}

export async function regenerateRecoveryKeyBackup(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<RegenerateRecoveryKeyResult> {
  const parsed = RegenerateRecoveryKeySchema.parse(params);

  const adapter = getSodium();
  let kek: AeadKey | undefined;
  let masterKey: KdfMasterKey | undefined;
  let serializedBackup: Uint8Array | undefined;
  let newRecoveryKeyResult: RecoveryKeyResult | undefined;

  try {
    const result = await withAccountTransaction(db, accountId, async (tx) => {
      const [account] = await tx
        .select({
          passwordHash: accounts.passwordHash,
          kdfSalt: accounts.kdfSalt,
          encryptedMasterKey: accounts.encryptedMasterKey,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      if (!account) {
        throw new ValidationError(INCORRECT_PASSWORD_ERROR);
      }

      const valid = verifyPassword(account.passwordHash, parsed.currentPassword);
      if (!valid) {
        throw new ValidationError(INCORRECT_PASSWORD_ERROR);
      }

      // Look up active recovery key before doing crypto work
      const activeRows = await tx
        .select({
          id: recoveryKeys.id,
        })
        .from(recoveryKeys)
        .where(and(eq(recoveryKeys.accountId, accountId), isNull(recoveryKeys.revokedAt)))
        .limit(1);

      const activeKey = activeRows[0];
      if (!activeKey) {
        throw new NoActiveRecoveryKeyError("No active recovery key to revoke");
      }

      const encMasterKeyBytes = account.encryptedMasterKey;
      if (!encMasterKeyBytes) {
        throw new Error("Account missing encrypted master key");
      }
      const payload = deserializeEncryptedPayload(
        encMasterKeyBytes instanceof Uint8Array
          ? encMasterKeyBytes
          : new Uint8Array(encMasterKeyBytes),
      );

      const salt = fromHex(account.kdfSalt);
      if (salt.length !== PWHASH_SALT_BYTES) {
        throw new Error("Stored KDF salt has invalid length");
      }
      kek = await derivePasswordKey(parsed.currentPassword, salt as PwhashSalt, "server");
      masterKey = unwrapMasterKey(payload, kek);

      const regenResult = regenerateRecoveryKey(masterKey);
      newRecoveryKeyResult = regenResult.newRecoveryKey;
      serializedBackup = regenResult.serializedBackup;
      const backupForInsert = serializedBackup;
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
        encryptedMasterKey: backupForInsert,
        createdAt: timestamp,
      });

      await audit(tx, {
        eventType: "auth.recovery-key-regenerated",
        actor: { kind: "account", id: accountId },
        detail: "Recovery key regenerated",
      });

      return { displayKey: regenResult.newRecoveryKey.displayKey };
    });

    return { recoveryKey: result.displayKey };
  } finally {
    if (kek) adapter.memzero(kek);
    if (masterKey) adapter.memzero(masterKey);
    if (serializedBackup) adapter.memzero(serializedBackup);
    if (newRecoveryKeyResult) {
      adapter.memzero(newRecoveryKeyResult.encryptedMasterKey.ciphertext);
      adapter.memzero(newRecoveryKeyResult.encryptedMasterKey.nonce);
    }
  }
}

// ── Reset Password via Recovery Key ──────────────────────────────

export interface PasswordResetResult {
  readonly sessionToken: SessionId;
  readonly recoveryKey: string;
  readonly accountId: AccountId;
}

export async function resetPasswordWithRecoveryKey(
  db: PostgresJsDatabase,
  params: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
  log: AppLogger,
): Promise<PasswordResetResult | null> {
  const startTime = performance.now();
  const parsed = PasswordResetViaRecoveryKeySchema.parse(params);

  const emailHash = hashEmail(parsed.email);

  // Look up account by email hash
  const [account] = await db
    .select({
      id: accounts.id,
      passwordHash: accounts.passwordHash,
      kdfSalt: accounts.kdfSalt,
      encryptedMasterKey: accounts.encryptedMasterKey,
    })
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    // Anti-enumeration: do dummy work + timing equalization
    try {
      verifyPassword(DUMMY_ARGON2_HASH, parsed.newPassword);
    } catch (err: unknown) {
      log.error(
        "Unexpected verifyPassword error during anti-enumeration",
        err instanceof Error ? { err } : { error: String(err) },
      );
    }
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  // Fetch active recovery key's encrypted backup (account-scoped read)
  const activeKey = await withAccountRead(db, account.id as AccountId, async (tx) => {
    const [row] = await tx
      .select({
        id: recoveryKeys.id,
        encryptedMasterKey: recoveryKeys.encryptedMasterKey,
      })
      .from(recoveryKeys)
      .where(and(eq(recoveryKeys.accountId, account.id), isNull(recoveryKeys.revokedAt)))
      .limit(1);
    return row ?? null;
  });

  if (!activeKey) {
    // Anti-enumeration: match the verifyPassword latency of the "no account" path
    try {
      verifyPassword(DUMMY_ARGON2_HASH, parsed.newPassword);
    } catch (err: unknown) {
      log.error(
        "Unexpected verifyPassword error during anti-enumeration",
        err instanceof Error ? { err } : { error: String(err) },
      );
    }
    await equalizeAntiEnumTiming(startTime);
    throw new NoActiveRecoveryKeyError("No active recovery key found");
  }

  const adapter = getSodium();
  let masterKey: KdfMasterKey | undefined;
  let newRecoveryKeyResult: RecoveryKeyResult | undefined;
  let newSalt: PwhashSalt | undefined;
  let wrappedMasterKeyBytes: Uint8Array | undefined;
  let newRecoveryBackupBytes: Uint8Array | undefined;

  try {
    const encBackup = activeKey.encryptedMasterKey;
    const encBackupBytes = encBackup instanceof Uint8Array ? encBackup : new Uint8Array(encBackup);

    // Crypto: reset password via recovery key
    const resetResult = await resetPasswordViaRecoveryKey({
      displayKey: parsed.recoveryKey,
      encryptedBackup: encBackupBytes,
      newPassword: parsed.newPassword,
      pwhashProfile: "server",
    });

    masterKey = resetResult.masterKey;
    newSalt = resetResult.newSalt;
    newRecoveryKeyResult = resetResult.newRecoveryKey;

    // Hash the new password for storage
    const newPasswordHash = hashPassword(parsed.newPassword, "server");
    const newKdfSaltHex = toHex(newSalt);
    wrappedMasterKeyBytes = serializeEncryptedPayload(resetResult.wrappedMasterKey);
    newRecoveryBackupBytes = serializeRecoveryBackup(resetResult.newRecoveryKey.encryptedMasterKey);

    // Capture for use in transaction closure (avoids non-null assertions)
    const wrappedKeyForTx = wrappedMasterKeyBytes;
    const recoveryBackupForTx = newRecoveryBackupBytes;
    const timestamp = now();
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const sessionId = createId(ID_PREFIXES.session);
    const newRecoveryKeyId = createId(ID_PREFIXES.recoveryKey);
    const timeouts = SESSION_TIMEOUTS[platform];
    const expiresAt = timestamp + timeouts.absoluteTtlMs;

    await withAccountTransaction(db, account.id as AccountId, async (tx) => {
      // Update account: new password hash, KDF salt, encrypted master key
      await tx
        .update(accounts)
        .set({
          passwordHash: newPasswordHash,
          kdfSalt: newKdfSaltHex,
          encryptedMasterKey: wrappedKeyForTx,
          updatedAt: timestamp,
        })
        .where(eq(accounts.id, account.id));

      // Revoke old recovery key (verify it succeeded to prevent TOCTOU race)
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
        encryptedMasterKey: recoveryBackupForTx,
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

      // Audit event
      await audit(tx, {
        eventType: "auth.password-reset-via-recovery",
        actor: { kind: "account", id: account.id },
        detail: "Password reset via recovery key",
        accountId: account.id as AccountId,
      });
    });

    return {
      sessionToken: rawToken as SessionId,
      recoveryKey: newRecoveryKeyResult.displayKey,
      accountId: account.id as AccountId,
    };
  } finally {
    if (masterKey) adapter.memzero(masterKey);
    if (newSalt) adapter.memzero(newSalt);
    if (wrappedMasterKeyBytes) adapter.memzero(wrappedMasterKeyBytes);
    if (newRecoveryBackupBytes) adapter.memzero(newRecoveryBackupBytes);
    if (newRecoveryKeyResult) {
      adapter.memzero(newRecoveryKeyResult.encryptedMasterKey.ciphertext);
      adapter.memzero(newRecoveryKeyResult.encryptedMasterKey.nonce);
    }
    // Ensure timing equalization on ALL exit paths (including crypto failure)
    await equalizeAntiEnumTiming(startTime);
  }
}

// ── Errors ───────────────────────────────────────────────────────

class NoActiveRecoveryKeyError extends Error {
  override readonly name = "NoActiveRecoveryKeyError" as const;
}

export { DecryptionFailedError, InvalidInputError, NoActiveRecoveryKeyError };
