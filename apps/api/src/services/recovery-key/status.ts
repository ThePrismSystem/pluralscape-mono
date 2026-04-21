import { recoveryKeys } from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { withAccountRead } from "../../lib/rls-context.js";

import type { AccountId, UnixMillis } from "@pluralscape/types";
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
