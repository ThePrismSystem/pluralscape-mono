/**
 * Shared helpers for RLS integration test suites.
 *
 * Used by: rls-account-isolation, rls-system-isolation, rls-dual-tenant,
 *          rls-systems-pk, rls-audit-log, rls-key-grants,
 *          rls-policy-generation.
 *
 * Design notes:
 * - setSessionSystemId / setSessionAccountId use `set_config(..., false)` for
 *   session-scoped behavior. PGlite doesn't use explicit transactions — each
 *   Drizzle query is its own implicit transaction, so `true` (transaction-local)
 *   wouldn't persist between queries. Production code in session.ts uses `true`
 *   inside explicit transactions.
 * - createAccountsAndSystemsSchema centralises the two-table DDL block that
 *   was duplicated across the audit-introduced describe blocks.
 */

import { sql } from "drizzle-orm";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// Session GUC setters
// ---------------------------------------------------------------------------

export async function setSessionSystemId(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_system_id', ${systemId}, false)`);
}

export async function setSessionAccountId(
  db: PgliteDatabase<Record<string, unknown>>,
  accountId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_account_id', ${accountId}, false)`);
}

export async function clearSessionContext(
  db: PgliteDatabase<Record<string, unknown>>,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
  await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
}

export async function clearSessionSystemId(
  db: PgliteDatabase<Record<string, unknown>>,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
}

export async function clearSessionAccountId(
  db: PgliteDatabase<Record<string, unknown>>,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
}

// ---------------------------------------------------------------------------
// Schema DDL builders
// ---------------------------------------------------------------------------

/** Shared accounts + systems DDL used by suites that need both parent tables. */
export async function createAccountsAndSystemsSchema(client: PGliteType): Promise<void> {
  await client.query(`
    CREATE TABLE accounts (
      id VARCHAR(255) PRIMARY KEY,
      email_hash VARCHAR(255) NOT NULL UNIQUE,
      email_salt VARCHAR(255) NOT NULL,
      auth_key_hash BYTEA NOT NULL,
      kdf_salt VARCHAR(255),
      encrypted_master_key BYTEA,
      challenge_nonce BYTEA,
      challenge_expires_at TIMESTAMPTZ,
      encrypted_email BYTEA,
      account_type VARCHAR(50) NOT NULL DEFAULT 'system',
      audit_log_ip_tracking BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);
  await client.query(`
    CREATE TABLE systems (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      encrypted_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ
    )
  `);
}

/** Standalone accounts DDL (no systems FK) for account-only isolation suites. */
export async function createAccountsSchema(client: PGliteType): Promise<void> {
  await client.query(`
    CREATE TABLE accounts (
      id VARCHAR(255) PRIMARY KEY,
      email_hash VARCHAR(255) NOT NULL UNIQUE,
      email_salt VARCHAR(255) NOT NULL,
      auth_key_hash BYTEA NOT NULL,
      kdf_salt VARCHAR(255),
      encrypted_master_key BYTEA,
      challenge_nonce BYTEA,
      challenge_expires_at TIMESTAMPTZ,
      encrypted_email BYTEA,
      account_type VARCHAR(50) NOT NULL DEFAULT 'system',
      audit_log_ip_tracking BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);
}

// ---------------------------------------------------------------------------
// Role constant
// ---------------------------------------------------------------------------

export const APP_ROLE = "app_user";
