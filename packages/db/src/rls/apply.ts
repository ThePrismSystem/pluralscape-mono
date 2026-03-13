/**
 * Applies RLS policies to all tenant tables.
 *
 * Idempotent: drops existing policies before re-creating them.
 * Safe to run repeatedly against the same database.
 */

import { dropPolicySql, generateRlsStatements, RLS_TABLE_POLICIES } from "./policies.js";

/** Minimal executor interface — accepts any object that can execute a raw SQL string. */
export interface RlsExecutor {
  /** Execute a single raw SQL statement. */
  execute(sql: string): Promise<void>;
}

/**
 * Applies RLS (ENABLE + policy) to every table in RLS_TABLE_POLICIES.
 * Drops any existing policy with the same name first for idempotent re-application.
 * Each table is wrapped in a transaction for atomicity — if any statement fails
 * the entire batch is rolled back.
 *
 * @param executor - An object that can execute raw SQL strings
 */
export async function applyAllRls(executor: RlsExecutor): Promise<void> {
  const tableNames = Object.keys(RLS_TABLE_POLICIES) as Array<keyof typeof RLS_TABLE_POLICIES>;
  await executor.execute("BEGIN");
  try {
    for (const tableName of tableNames) {
      const statements = generateRlsStatements(tableName);
      for (const stmt of statements) {
        const drop = dropPolicySql(stmt);
        if (drop) {
          await executor.execute(drop);
        }
        await executor.execute(stmt);
      }
    }
    await executor.execute("COMMIT");
  } catch (error) {
    await executor.execute("ROLLBACK");
    throw error;
  }
}
