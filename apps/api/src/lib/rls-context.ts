import { setAccountId, setTenantContext } from "@pluralscape/db";

import type { PgExecutor } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Execute a function within a PostgreSQL transaction with RLS tenant context set.
 * The GUC variables (app.current_system_id, app.current_account_id) are
 * transaction-local and reset automatically when the transaction ends.
 */
export async function withTenantTransaction<T>(
  db: PostgresJsDatabase,
  context: { systemId: string; accountId: string },
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, context);
    return fn(tx);
  });
}

/**
 * Execute a function within a PostgreSQL transaction with RLS account context set.
 * Use for account-scoped operations (auth, sessions, account settings).
 */
export async function withAccountTransaction<T>(
  db: PostgresJsDatabase,
  accountId: string,
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setAccountId(tx, accountId);
    return fn(tx);
  });
}
