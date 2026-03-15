import { eq } from "drizzle-orm";

import { recoveryKeys as pgRecoveryKeys } from "../schema/pg/auth.js";
import { recoveryKeys as sqliteRecoveryKeys } from "../schema/sqlite/auth.js";

import type { NewRecoveryKey, RecoveryKeyRow } from "../schema/pg/auth.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Input types ───────────────────────────────────────────────────────────────

/** Input for storing a new recovery key backup. */
export interface StoreRecoveryKeyInput {
  readonly id: string;
  readonly accountId: string;
  readonly encryptedMasterKey: Uint8Array;
  readonly createdAt: number;
}

/** Input for atomically replacing a recovery key backup. */
export interface ReplaceRecoveryKeyInput {
  readonly revokeId: string;
  readonly revokedAt: number;
  readonly newRow: StoreRecoveryKeyInput;
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

/** Insert a new recovery key backup row. */
export async function pgStoreRecoveryKeyBackup<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  input: StoreRecoveryKeyInput,
): Promise<void> {
  const row: NewRecoveryKey = {
    id: input.id,
    accountId: input.accountId,
    encryptedMasterKey: input.encryptedMasterKey,
    createdAt: input.createdAt,
  };
  await db.insert(pgRecoveryKeys).values(row);
}

/** Return the active (non-revoked) recovery key for an account, or null if none exists. */
export async function pgGetActiveRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  accountId: string,
): Promise<RecoveryKeyRow | null> {
  const rows = await db
    .select()
    .from(pgRecoveryKeys)
    .where(eq(pgRecoveryKeys.accountId, accountId))
    .limit(1);
  const row = rows.find((r) => r.revokedAt === null);
  return row ?? null;
}

/** Set revokedAt on a recovery key row. */
export async function pgRevokeRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  id: string,
  revokedAt: number,
): Promise<void> {
  await db.update(pgRecoveryKeys).set({ revokedAt }).where(eq(pgRecoveryKeys.id, id));
}

/**
 * Atomically revoke the old recovery key and insert the new one.
 * Both operations execute in a single transaction.
 */
export async function pgReplaceRecoveryKeyBackup<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  input: ReplaceRecoveryKeyInput,
): Promise<void> {
  const newRow: NewRecoveryKey = {
    id: input.newRow.id,
    accountId: input.newRow.accountId,
    encryptedMasterKey: input.newRow.encryptedMasterKey,
    createdAt: input.newRow.createdAt,
  };
  await db.transaction(async (tx) => {
    await tx
      .update(pgRecoveryKeys)
      .set({ revokedAt: input.revokedAt })
      .where(eq(pgRecoveryKeys.id, input.revokeId));
    await tx.insert(pgRecoveryKeys).values(newRow);
  });
}

// ── SQLite ────────────────────────────────────────────────────────────────────

/** Insert a new recovery key backup row. */
export function sqliteStoreRecoveryKeyBackup<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, input: StoreRecoveryKeyInput): void {
  db.insert(sqliteRecoveryKeys)
    .values({
      id: input.id,
      accountId: input.accountId,
      encryptedMasterKey: input.encryptedMasterKey,
      createdAt: input.createdAt,
    })
    .run();
}

/** Return the active (non-revoked) recovery key for an account, or null if none exists. */
export function sqliteGetActiveRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, accountId: string): RecoveryKeyRow | null {
  const rows = db
    .select()
    .from(sqliteRecoveryKeys)
    .where(eq(sqliteRecoveryKeys.accountId, accountId))
    .all();
  const row = rows.find((r) => r.revokedAt === null);
  return row ?? null;
}

/** Set revokedAt on a recovery key row. */
export function sqliteRevokeRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, id: string, revokedAt: number): void {
  db.update(sqliteRecoveryKeys).set({ revokedAt }).where(eq(sqliteRecoveryKeys.id, id)).run();
}

/**
 * Atomically revoke the old recovery key and insert the new one.
 * Both operations execute in a single transaction.
 */
export function sqliteReplaceRecoveryKeyBackup<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, input: ReplaceRecoveryKeyInput): void {
  db.transaction((tx) => {
    tx.update(sqliteRecoveryKeys)
      .set({ revokedAt: input.revokedAt })
      .where(eq(sqliteRecoveryKeys.id, input.revokeId))
      .run();
    tx.insert(sqliteRecoveryKeys)
      .values({
        id: input.newRow.id,
        accountId: input.newRow.accountId,
        encryptedMasterKey: input.newRow.encryptedMasterKey,
        createdAt: input.newRow.createdAt,
      })
      .run();
  });
}
