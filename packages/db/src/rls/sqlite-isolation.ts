/**
 * SQLite tenant isolation helpers.
 *
 * SQLite has no RLS — isolation is enforced at the query layer.
 * These helpers return Drizzle `eq()` conditions that must be added
 * to every query's WHERE clause for tenant scoping.
 */

import { eq } from "drizzle-orm";

import type { AnyColumn, SQL } from "drizzle-orm";

/** Returns a Drizzle WHERE condition: `system_id = ?` */
export function systemScope(systemIdColumn: AnyColumn, systemId: string): SQL {
  return eq(systemIdColumn, systemId);
}

/** Returns a Drizzle WHERE condition: `account_id = ?` */
export function accountScope(accountIdColumn: AnyColumn, accountId: string): SQL {
  return eq(accountIdColumn, accountId);
}
