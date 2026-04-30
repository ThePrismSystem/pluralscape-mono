import { assertAuthKey, assertAuthKeyHash, verifyAuthKey } from "@pluralscape/crypto";
import { accounts, recoveryKeys } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { ensureUint8Array } from "../../lib/binary.js";
import { fromHex } from "../../lib/hex.js";
import { withAccountTransaction } from "../../lib/rls-context.js";
import { ValidationError } from "../auth/register.js";
import { INCORRECT_PASSWORD_ERROR } from "../auth.constants.js";

import { NoActiveRecoveryKeyError } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, RecoveryKeyId } from "@pluralscape/types";
import type { RegenerateRecoveryKeySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

// ── Regenerate Recovery Key ──────────────────────────────────────

export interface RegenerateRecoveryKeyResult {
  readonly ok: true;
}

export async function regenerateRecoveryKeyBackup(
  db: PostgresJsDatabase,
  accountId: AccountId,
  body: z.infer<typeof RegenerateRecoveryKeySchema>,
  audit: AuditWriter,
): Promise<RegenerateRecoveryKeyResult> {
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
    assertAuthKeyHash(storedHash);
    const authKeyBytes = fromHex(body.authKey);
    assertAuthKey(authKeyBytes);
    const valid = verifyAuthKey(authKeyBytes, storedHash);
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

    const newRecoveryEncryptedMasterKeyBytes = fromHex(body.newRecoveryEncryptedMasterKey);
    const recoveryKeyHashBytes = fromHex(body.recoveryKeyHash);
    const timestamp = now();
    const newId = brandId<RecoveryKeyId>(createId(ID_PREFIXES.recoveryKey));

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
