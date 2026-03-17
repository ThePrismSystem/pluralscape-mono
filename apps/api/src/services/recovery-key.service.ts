import {
  PWHASH_SALT_BYTES,
  derivePasswordKey,
  getSodium,
  regenerateRecoveryKey,
  unwrapMasterKey,
  verifyPassword,
} from "@pluralscape/crypto";
import { accounts, recoveryKeys } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { RegenerateRecoveryKeySchema } from "@pluralscape/validation";
import { and, eq, isNull } from "drizzle-orm";

import { writeAuditLog } from "../lib/audit-log.js";
import { deserializeEncryptedPayload } from "../lib/encrypted-payload.js";
import { fromHex } from "../lib/hex.js";
import { INCORRECT_PASSWORD_ERROR } from "../routes/account/account.constants.js";

import { ValidationError } from "./auth.service.js";

import type { RequestMeta } from "../lib/request-meta.js";
import type { AeadKey, KdfMasterKey, PwhashSalt } from "@pluralscape/crypto";
import type { AccountId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Recovery Key Status ──────────────────────────────────────────

export interface RecoveryKeyStatus {
  readonly hasActiveKey: boolean;
  readonly createdAt: UnixMillis | null;
}

export async function getRecoveryKeyStatus(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<RecoveryKeyStatus> {
  const rows = await db
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
  return { hasActiveKey: true, createdAt: row.createdAt as UnixMillis };
}

// ── Regenerate Recovery Key ──────────────────────────────────────

export interface RegenerateRecoveryKeyResult {
  readonly recoveryKey: string;
}

export async function regenerateRecoveryKeyBackup(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  requestMeta: RequestMeta,
): Promise<RegenerateRecoveryKeyResult> {
  const parsed = RegenerateRecoveryKeySchema.parse(params);

  if (!parsed.confirmed) {
    throw new ValidationError("Recovery key backup must be confirmed");
  }

  const [account] = await db
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
  const activeRows = await db
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

  const adapter = getSodium();
  let kek: AeadKey | undefined;
  let masterKey: KdfMasterKey | undefined;

  try {
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

    const { newRecoveryKey, serializedBackup } = regenerateRecoveryKey(masterKey);
    const timestamp = now();
    const newId = createId(ID_PREFIXES.recoveryKey);

    await db.transaction(async (tx) => {
      const revoked = await tx
        .update(recoveryKeys)
        .set({ revokedAt: timestamp })
        .where(eq(recoveryKeys.id, activeKey.id))
        .returning({ id: recoveryKeys.id });

      if (revoked.length === 0) {
        throw new Error("Recovery key not found during revocation");
      }

      await tx.insert(recoveryKeys).values({
        id: newId,
        accountId,
        encryptedMasterKey: serializedBackup,
        createdAt: timestamp,
      });

      await writeAuditLog(tx, {
        accountId,
        systemId: null,
        eventType: "auth.recovery-key-regenerated",
        actor: { kind: "account", id: accountId },
        detail: "Recovery key regenerated",
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
    });

    return { recoveryKey: newRecoveryKey.displayKey };
  } finally {
    if (kek) adapter.memzero(kek);
    if (masterKey) adapter.memzero(masterKey);
  }
}

// ── Errors ───────────────────────────────────────────────────────

class NoActiveRecoveryKeyError extends Error {
  override readonly name = "NoActiveRecoveryKeyError" as const;
}

export { NoActiveRecoveryKeyError };
