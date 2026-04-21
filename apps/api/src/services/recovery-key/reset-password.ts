import {
  assertAuthKey,
  assertRecoveryKeyHash,
  hashAuthKey,
  verifyRecoveryKey,
} from "@pluralscape/crypto";
import { accounts, recoveryKeys, sessions } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  SESSION_TIMEOUTS,
  createId,
  now,
} from "@pluralscape/types";
import { PasswordResetViaRecoveryKeySchema } from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";
import { ensureUint8Array } from "../../lib/binary.js";
import { hashEmail } from "../../lib/email-hash.js";
import { fromHex } from "../../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../../lib/rls-context.js";
import { generateSessionToken, hashSessionToken } from "../../lib/session-token.js";

import { NoActiveRecoveryKeyError } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { ClientPlatform } from "../../routes/auth/auth.constants.js";
import type { AccountId, SessionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
  const activeKey = await withAccountRead(db, brandId<AccountId>(account.id), async (tx) => {
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

  // Verify recovery key hash — reject if no hash stored (pre-migration data)
  if (!activeKey.recoveryKeyHash) {
    void audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "account", id: account.id },
      detail: "Recovery key missing server-side hash (pre-migration)",
    }).catch(() => {
      // Best-effort audit — don't fail the request if audit write fails
    });
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  const storedRecoveryHash = ensureUint8Array(activeKey.recoveryKeyHash);
  assertRecoveryKeyHash(storedRecoveryHash);
  const recoveryKeyValid = verifyRecoveryKey(fromHex(parsed.recoveryKeyHash), storedRecoveryHash);
  if (!recoveryKeyValid) {
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  try {
    const newAuthKeyBytes = fromHex(parsed.newAuthKey);
    assertAuthKey(newAuthKeyBytes);
    const newAuthKeyHash = hashAuthKey(newAuthKeyBytes);
    const newEncryptedMasterKeyBytes = fromHex(parsed.newEncryptedMasterKey);
    const newRecoveryEncryptedMasterKeyBytes = fromHex(parsed.newRecoveryEncryptedMasterKey);

    const timestamp = now();
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const sessionId = createId(ID_PREFIXES.session);
    const newRecoveryKeyId = createId(ID_PREFIXES.recoveryKey);
    const timeouts = SESSION_TIMEOUTS[platform];
    const expiresAt = timestamp + timeouts.absoluteTtlMs;

    await withAccountTransaction(db, brandId<AccountId>(account.id), async (tx) => {
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
        recoveryKeyHash: fromHex(parsed.newRecoveryKeyHash),
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
        accountId: brandId<AccountId>(account.id),
      });
    });

    return {
      sessionToken: brandId<SessionId>(rawToken),
      accountId: brandId<AccountId>(account.id),
    };
  } finally {
    await equalizeAntiEnumTiming(startTime);
  }
}
