/**
 * PostgreSQL session variable helpers for RLS.
 *
 * These set transaction-local GUC variables that RLS policies reference.
 * The `true` parameter to set_config makes the setting transaction-local,
 * meaning it resets automatically when the transaction ends.
 */

import { sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";

/** Minimal interface for a Drizzle PG database that can execute raw SQL. */
export interface PgExecutor {
  execute(query: SQL): Promise<unknown>;
}

/** Sets the current system ID for RLS policies (transaction-scoped). */
export async function setSystemId(db: PgExecutor, systemId: string): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_system_id', ${systemId}, true)`);
}

/** Sets the current account ID for RLS policies (transaction-scoped). */
export async function setAccountId(db: PgExecutor, accountId: string): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_account_id', ${accountId}, true)`);
}

/** Sets both system and account context for RLS policies (transaction-scoped). */
export async function setTenantContext(
  db: PgExecutor,
  context: { systemId: string; accountId: string },
): Promise<void> {
  await setSystemId(db, context.systemId);
  await setAccountId(db, context.accountId);
}

/** Returns a raw SQL fragment for setting the system ID. Useful in raw queries. */
export function setSystemIdSql(systemId: string): SQL {
  return sql`SELECT set_config('app.current_system_id', ${systemId}, true)`;
}

/** Returns a raw SQL fragment for setting the account ID. Useful in raw queries. */
export function setAccountIdSql(accountId: string): SQL {
  return sql`SELECT set_config('app.current_account_id', ${accountId}, true)`;
}
