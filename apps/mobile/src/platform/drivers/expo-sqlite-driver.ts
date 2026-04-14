import {
  deleteDatabaseSync,
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from "expo-sqlite";

import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

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
 * Tests whether the database is accessible (encrypted databases require the
 * correct PRAGMA key before any queries succeed).
 */
function isDatabaseAccessible(db: SQLiteDatabase): boolean {
  try {
    db.execSync("SELECT count(*) FROM sqlite_master");
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps expo-sqlite into the SqliteDriver interface used by @pluralscape/sync adapters.
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
): Promise<SqliteDriver> {
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

  const driver: SqliteDriver = {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      return {
        run(...params: unknown[]): void {
          const stmt = db.prepareSync(sql);
          try {
            stmt.executeSync(params as SQLiteBindParams);
          } finally {
            stmt.finalizeSync();
          }
        },
        all(...params: unknown[]): TRow[] {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            return result.getAllSync();
          } finally {
            stmt.finalizeSync();
          }
        },
        get(...params: unknown[]): TRow | undefined {
          const stmt = db.prepareSync(sql);
          try {
            const result = stmt.executeSync<TRow>(params as SQLiteBindParams);
            const first = result.getFirstSync();
            return first ?? undefined;
          } finally {
            stmt.finalizeSync();
          }
        },
      };
    },

    exec(sql: string): void {
      db.execSync(sql);
    },

    transaction<T>(fn: () => T): T {
      let result!: T;
      db.withTransactionSync(() => {
        result = fn();
      });
      return result;
    },

    close(): void {
      db.closeSync();
    },
  };

  return Promise.resolve(driver);
}
