/**
 * Applies RLS policies to all tenant tables.
 *
 * Idempotent: drops existing policies before re-creating them.
 * Safe to run repeatedly against the same database.
 */

import { generateRlsStatements, RLS_TABLE_POLICIES } from "./policies.js";

/** Minimal executor interface — works with postgres.js sql tagged template results. */
export interface RlsExecutor {
  /** Execute a single raw SQL statement. */
  execute(sql: string): Promise<void>;
}

/** Regex to extract policy name and table name from CREATE POLICY statements. */
const CREATE_POLICY_RE = /^CREATE POLICY (\S+) ON (\S+) /;

/**
 * Applies RLS (ENABLE + policy) to every table in RLS_TABLE_POLICIES.
 * Drops any existing policy with the same name first for idempotent re-application.
 *
 * @param executor - An object that can execute raw SQL strings
 */
export async function applyAllRls(executor: RlsExecutor): Promise<void> {
  const tableNames = Object.keys(RLS_TABLE_POLICIES);
  for (const tableName of tableNames) {
    const statements = generateRlsStatements(tableName);
    for (const stmt of statements) {
      const match = CREATE_POLICY_RE.exec(stmt);
      const policyName = match?.[1];
      const policyTable = match?.[2];
      if (policyName && policyTable) {
        await executor.execute(`DROP POLICY IF EXISTS ${policyName} ON ${policyTable}`);
      }
      await executor.execute(stmt);
    }
  }
}
