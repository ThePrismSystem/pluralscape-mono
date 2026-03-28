import { setAccountId, setTenantContext } from "@pluralscape/db";
import { sql } from "drizzle-orm";

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
 * "Read" variants enforce `SET TRANSACTION READ ONLY` so the DB rejects any accidental
 * INSERT/UPDATE/DELETE within the callback, providing a runtime safety net.
 */

/** Shared tenant context shape used by tenant-scoped helpers. */
export interface TenantContext {
  readonly systemId: SystemId;
  readonly accountId: AccountId;
}

type TxCallback<T> = (tx: PostgresJsDatabase & PgExecutor) => Promise<T>;

// ── Write Helpers (transactions with INSERT/UPDATE/DELETE) ───────

/**
 * Execute a write operation within a PostgreSQL transaction with RLS tenant context set.
 * The GUC variables (app.current_system_id, app.current_account_id) are
 * transaction-local and reset automatically when the transaction ends.
 */
export async function withTenantTransaction<T>(
  db: PostgresJsDatabase,
  context: TenantContext,
  fn: TxCallback<T>,
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
  accountId: AccountId,
  fn: TxCallback<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setAccountId(tx, accountId);
    return fn(tx);
  });
}

// ── Cross-Account Helpers (no RLS context) ───────────────────────

/**
 * Execute a write operation in a transaction without RLS context.
 *
 * Use ONLY for cross-account operations where application-level validation
 * replaces row-level security (e.g., friend code redemption creates rows for
 * both accounts, bilateral connection updates modify the reverse direction).
 *
 * Callers MUST validate all inputs before using this helper — no RLS safety net.
 */
export async function withCrossAccountTransaction<T>(
  db: PostgresJsDatabase,
  fn: TxCallback<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

// ── Cross-Account Read Helper ────────────────────────────────────

/**
 * Execute a read-only query without RLS context.
 *
 * Use for cross-account reads where application-level validation
 * replaces row-level security (e.g., friend dashboard reads data
 * from a target system after verifying friend access).
 *
 * Callers MUST validate all inputs before using this helper — no RLS safety net.
 * Enforces `SET TRANSACTION READ ONLY` to prevent accidental writes.
 */
export async function withCrossAccountRead<T>(
  db: PostgresJsDatabase,
  fn: TxCallback<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return fn(tx);
  });
}

// ── Read Helpers (SELECT-only operations) ────────────────────────

/**
 * Execute a read-only query with RLS tenant context set.
 * Enforces `SET TRANSACTION READ ONLY` — the DB will reject any write statements.
 */
export async function withTenantRead<T>(
  db: PostgresJsDatabase,
  context: TenantContext,
  fn: TxCallback<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, context);
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return fn(tx);
  });
}

/**
 * Execute a read-only query with RLS account context set.
 * Enforces `SET TRANSACTION READ ONLY` — the DB will reject any write statements.
 */
export async function withAccountRead<T>(
  db: PostgresJsDatabase,
  accountId: AccountId,
  fn: TxCallback<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setAccountId(tx, accountId);
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return fn(tx);
  });
}
