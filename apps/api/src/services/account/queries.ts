import { accounts, systems } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { withAccountRead } from "../../lib/rls-context.js";

import type { AccountId, AccountType, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
      systemId = system ? brandId<SystemId>(system.id) : null;
    }

    return {
      accountId: brandId<AccountId>(row.accountId),
      accountType: row.accountType,
      systemId,
      auditLogIpTracking: row.auditLogIpTracking,
      version: row.version,
      createdAt: toUnixMillis(row.createdAt),
      updatedAt: toUnixMillis(row.updatedAt),
    };
  });
}
