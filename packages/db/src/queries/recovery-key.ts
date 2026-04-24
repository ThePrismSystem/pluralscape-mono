import { and, eq, isNull } from "drizzle-orm";

import { recoveryKeys as pgRecoveryKeys } from "../schema/pg/auth.js";
import { recoveryKeys as sqliteRecoveryKeys } from "../schema/sqlite/auth.js";

import type { NewRecoveryKey, RecoveryKeyRow } from "../schema/pg/auth.js";
import type { AccountId, RecoveryKeyId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Input types ───────────────────────────────────────────────────────────────

/** Input for storing a new recovery key backup. */
export interface StoreRecoveryKeyInput {
  readonly id: RecoveryKeyId;
  readonly accountId: AccountId;
  readonly encryptedMasterKey: Uint8Array;
  readonly createdAt: UnixMillis;
}

/** Input for atomically replacing a recovery key backup. */
export interface ReplaceRecoveryKeyInput {
  readonly revokeId: RecoveryKeyId;
  readonly revokedAt: UnixMillis;
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
  accountId: AccountId,
): Promise<RecoveryKeyRow | null> {
  const rows = await db
    .select()
    .from(pgRecoveryKeys)
    .where(and(eq(pgRecoveryKeys.accountId, accountId), isNull(pgRecoveryKeys.revokedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** Set revokedAt on a recovery key row. Throws if no matching row exists. */
export async function pgRevokeRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  id: RecoveryKeyId,
  revokedAt: UnixMillis,
): Promise<void> {
  const rows = await db
    .update(pgRecoveryKeys)
    .set({ revokedAt })
    .where(eq(pgRecoveryKeys.id, id))
    .returning();
  if (rows.length === 0) {
    throw new Error("Recovery key not found.");
  }
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
    const revoked = await tx
      .update(pgRecoveryKeys)
      .set({ revokedAt: input.revokedAt })
      .where(eq(pgRecoveryKeys.id, input.revokeId))
      .returning();
    if (revoked.length === 0) {
      throw new Error("Recovery key not found.");
    }
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
>(db: BetterSQLite3Database<TSchema>, accountId: AccountId): RecoveryKeyRow | null {
  const rows = db
    .select()
    .from(sqliteRecoveryKeys)
    .where(and(eq(sqliteRecoveryKeys.accountId, accountId), isNull(sqliteRecoveryKeys.revokedAt)))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

/** Set revokedAt on a recovery key row. Throws if no matching row exists. */
export function sqliteRevokeRecoveryKey<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, id: RecoveryKeyId, revokedAt: UnixMillis): void {
  const result = db
    .update(sqliteRecoveryKeys)
    .set({ revokedAt })
    .where(eq(sqliteRecoveryKeys.id, id))
    .run();
  if (result.changes === 0) {
    throw new Error("Recovery key not found.");
  }
}

/**
 * Atomically revoke the old recovery key and insert the new one.
 * Both operations execute in a single transaction.
 */
export function sqliteReplaceRecoveryKeyBackup<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, input: ReplaceRecoveryKeyInput): void {
  db.transaction((tx) => {
    const result = tx
      .update(sqliteRecoveryKeys)
      .set({ revokedAt: input.revokedAt })
      .where(eq(sqliteRecoveryKeys.id, input.revokeId))
      .run();
    if (result.changes === 0) {
      throw new Error("Recovery key not found.");
    }
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
