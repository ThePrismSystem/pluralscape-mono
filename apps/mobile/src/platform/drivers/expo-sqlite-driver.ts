import { runAsyncTransaction } from "@pluralscape/sync/adapters";
import {
  deleteDatabaseSync,
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from "expo-sqlite";

import { createMaterializerDbAdapter } from "../../data/materializer-db-adapter.js";

import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";
import type { MaterializerDb } from "@pluralscape/sync/materializer";

const DB_NAME = "pluralscape-sync.db";

/**
 * Options for creating the expo-sqlite driver.
 */
export interface ExpoSqliteDriverOptions {
  /**
   * Hex-encoded SQLCipher encryption key. When provided, the driver issues
   * `PRAGMA key` immediately after opening the database to enable transparent
   * encryption at rest.
   *
   * Requires the `useSQLCipher` expo-sqlite config plugin to be enabled in
   * app.json — without it the PRAGMA is silently ignored by vanilla SQLite.
   *
   * The key must be derived from the user's master key via KDF (see
   * `DB_ENCRYPTION_KDF_CONTEXT` and `DB_ENCRYPTION_SUBKEY_ID` constants).
   */
  readonly encryptionKeyHex?: string;
}

/**
 * Pair returned by {@link createExpoSqliteDriver}: the async {@link SqliteDriver}
 * used by the storage adapter and the synchronous {@link MaterializerDb} used
 * by the materializer subscriber. Both wrap the same underlying expo-sqlite
 * connection so writes from each side share the SQLCipher session and a single
 * WAL.
 */
export interface ExpoSqliteAdapters {
  readonly driver: SqliteDriver;
  readonly materializerDb: MaterializerDb;
}

/**
 * KDF context for deriving the SQLite encryption key from the master key.
 * Must be exactly 8 bytes (libsodium KDF requirement).
 */
export const DB_ENCRYPTION_KDF_CONTEXT = "dbciphk!";

/**
 * KDF sub-key ID for the SQLite encryption key derivation.
 * Unique across the application's KDF sub-key space.
 */
export const DB_ENCRYPTION_SUBKEY_ID = 10;

/**
 * Length of the derived encryption key in bytes.
 * SQLCipher uses 256-bit (32-byte) keys by default.
 */
export const DB_ENCRYPTION_KEY_BYTES = 32;

/**
 * Tests whether the database is accessible under the current PRAGMA key.
 *
 * Encrypted databases return "file is not a database" / SQLITE_NOTADB when
 * read with the wrong key. Any other error (permissions, I/O, etc.) is
 * rethrown so it isn't silently misinterpreted as a decryption mismatch.
 */
function isDatabaseAccessible(db: SQLiteDatabase): boolean {
  try {
    db.execSync("SELECT count(*) FROM sqlite_master");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not a database|SQLITE_NOTADB|file is encrypted/i.test(msg)) return false;
    throw err;
  }
}

/**
 * Wraps expo-sqlite into the SqliteDriver interface used by @pluralscape/sync adapters
 * AND the synchronous {@link MaterializerDb} interface used by the materializer
 * subscriber. Both are backed by the same underlying expo-sqlite connection so writes
 * from each side share the SQLCipher session and a single WAL.
 *
 * expo-sqlite uses a synchronous API under the hood (JSI), wrapped in our interface.
 *
 * When `encryptionKeyHex` is provided, the driver:
 * 1. Opens the database
 * 2. Applies `PRAGMA key` with the hex-encoded key
 * 3. Verifies the database is accessible
 * 4. If inaccessible (pre-existing unencrypted DB), deletes and recreates with encryption
 *
 * Each run/all/get call prepares, executes, and finalizes the statement in one shot to
 * prevent native statement handle leaks.
 */
export function createExpoSqliteDriver(
  options: ExpoSqliteDriverOptions = {},
): Promise<ExpoSqliteAdapters> {
  const { encryptionKeyHex } = options;

  let db: SQLiteDatabase = openDatabaseSync(DB_NAME);

  if (encryptionKeyHex !== undefined) {
    // Apply SQLCipher encryption key via hex literal
    db.execSync(`PRAGMA key = "x'${encryptionKeyHex}'"`);

    if (!isDatabaseAccessible(db)) {
      // Database exists but was created without encryption (pre-production migration).
      // Close, delete the unencrypted file, and recreate with encryption.
      db.closeSync();
      deleteDatabaseSync(DB_NAME);

      db = openDatabaseSync(DB_NAME);
      db.execSync(`PRAGMA key = "x'${encryptionKeyHex}'"`);
    }
  }

  let txDepth = 0;

  const driver: SqliteDriver = {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      return {
        run(...params: unknown[]): Promise<void> {
          const stmt = db.prepareSync(sql);
          try {
            stmt.executeSync(params as SQLiteBindParams);
          } finally {
            stmt.finalizeSync();
          }
          return Promise.resolve();
        },
        all(...params: unknown[]): Promise<TRow[]> {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            return Promise.resolve(result.getAllSync());
          } finally {
            stmt.finalizeSync();
          }
        },
        get(...params: unknown[]): Promise<TRow | undefined> {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            const first = result.getFirstSync();
            return Promise.resolve(first ?? undefined);
          } finally {
            stmt.finalizeSync();
          }
        },
      };
    },

    exec(sql: string): Promise<void> {
      db.execSync(sql);
      return Promise.resolve();
    },

    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      if (txDepth > 0) {
        throw new Error("SqliteDriver.transaction: nested transactions are not supported");
      }
      txDepth++;
      try {
        return await runAsyncTransaction((sql) => {
          db.execSync(sql);
        }, fn);
      } finally {
        txDepth--;
      }
    },

    close(): Promise<void> {
      db.closeSync();
      return Promise.resolve();
    },
  };

  const materializerDb = createMaterializerDbAdapter(db);

  return Promise.resolve({ driver, materializerDb });
}
