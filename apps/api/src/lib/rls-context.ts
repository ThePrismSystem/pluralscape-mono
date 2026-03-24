import { setAccountId, setTenantContext } from "@pluralscape/db";

import type { PgExecutor } from "@pluralscape/db";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * RLS context helpers for PostgreSQL.
 *
 * All helpers use `db.transaction()` internally because:
 * 1. `set_config(..., true)` creates transaction-local GUC variables that reset on COMMIT/ROLLBACK
 * 2. With connection pooling (postgres.js), each `db.execute()` may use a different pooled connection,
 *    so session-scoped SET would leak context across requests
 * 3. A transaction pins a single connection for the duration, ensuring the GUC and queries share it
 *
 * "Read" variants are semantically identical to "Transaction" variants but signal that the
 * enclosed operations are read-only. This distinction enables future optimisation (e.g.
 * connection reservation without BEGIN/COMMIT) and makes write vs read intent explicit in code.
 */

// ── Write Helpers (transactions with INSERT/UPDATE/DELETE) ───────

/**
 * Execute a write operation within a PostgreSQL transaction with RLS tenant context set.
 * The GUC variables (app.current_system_id, app.current_account_id) are
 * transaction-local and reset automatically when the transaction ends.
 */
export async function withTenantTransaction<T>(
  db: PostgresJsDatabase,
  context: { systemId: SystemId | string; accountId: AccountId | string },
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, context);
    return fn(tx);
  });
}

/**
 * Execute a write operation within a PostgreSQL transaction with RLS account context set.
 * Use for account-scoped write operations (auth, sessions, account settings).
 */
export async function withAccountTransaction<T>(
  db: PostgresJsDatabase,
  accountId: AccountId | string,
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setAccountId(tx, accountId);
    return fn(tx);
  });
}

// ── Read Helpers (SELECT-only operations) ────────────────────────

/**
 * Execute a read-only query with RLS tenant context set.
 * Internally uses a transaction for connection pinning (see module-level comment).
 */
export async function withTenantRead<T>(
  db: PostgresJsDatabase,
  context: { systemId: SystemId | string; accountId: AccountId | string },
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, context);
    return fn(tx);
  });
}

/**
 * Execute a read-only query with RLS account context set.
 * Internally uses a transaction for connection pinning (see module-level comment).
 */
export async function withAccountRead<T>(
  db: PostgresJsDatabase,
  accountId: AccountId | string,
  fn: (tx: PostgresJsDatabase & PgExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setAccountId(tx, accountId);
    return fn(tx);
  });
}
