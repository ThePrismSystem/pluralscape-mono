import type { MaterializerDb } from "@pluralscape/sync/materializer";
import type { SQLiteBindParams } from "expo-sqlite";

/**
 * Subset of expo-sqlite's `SQLiteExecuteSyncResult` we exercise. The
 * materializer reads rows back via `getAllSync`; the other surface methods
 * (`getFirstSync`, `resetSync`, etc.) are out of scope.
 */
export interface ExecuteSyncResult<T> {
  readonly getAllSync: () => T[];
}

/**
 * Subset of expo-sqlite's `SQLiteStatement` we exercise. The two methods
 * mirror the prepare/finalize half of the JSI-prepared-statement lifecycle.
 *
 * Methods are declared as arrow-function properties so consumers can pass
 * them around without binding gymnastics — keeps test mocks free of
 * unbound-method lint noise.
 */
export interface SqliteStatementHandle {
  readonly executeSync: <T>(params: SQLiteBindParams) => ExecuteSyncResult<T>;
  readonly finalizeSync: () => void;
}

/**
 * Minimal expo-sqlite database surface the materializer needs. Defining the
 * interface here (rather than importing `SQLiteDatabase`) keeps the adapter
 * decoupled from expo-sqlite's much larger public type and lets tests pass
 * lightweight mocks without `as unknown as` gymnastics.
 *
 * Real callers pass an `SQLiteDatabase` opened via `openDatabaseSync`; the
 * structural subset is satisfied automatically.
 */
export interface SqliteSyncDatabase {
  readonly prepareSync: (sql: string) => SqliteStatementHandle;
  readonly withTransactionSync: (fn: () => void) => void;
}

/**
 * Adapter wrapping `expo-sqlite`'s synchronous JSI APIs into the
 * `MaterializerDb` interface used by the materializer.
 *
 * The materializer issues dynamic INSERT OR REPLACE statements with positional
 * parameters; this adapter forwards them to `prepareSync` / `executeSync` and
 * runs `withTransactionSync` to batch a merge's writes into a single SQLite
 * transaction (per local-first consensus — synchronous in-transaction
 * materialization, no concurrent writers under WAL).
 *
 * Statement handles are finalised in `finally` to avoid native leaks if the
 * caller throws.
 */
export function createMaterializerDbAdapter(db: SqliteSyncDatabase): MaterializerDb {
  return {
    queryAll<T>(sql: string, params: unknown[]): T[] {
      const stmt = db.prepareSync(sql);
      try {
        const result = stmt.executeSync<T>(params as SQLiteBindParams);
        return result.getAllSync();
      } finally {
        stmt.finalizeSync();
      }
    },
    execute(sql: string, params: unknown[]): void {
      const stmt = db.prepareSync(sql);
      try {
        stmt.executeSync(params as SQLiteBindParams);
      } finally {
        stmt.finalizeSync();
      }
    },
    transaction<T>(fn: () => T): T {
      // `withTransactionSync` invokes its callback synchronously inside BEGIN
      // and rethrows if `fn` does — so when this assignment lands here, `result`
      // has been set or the line below never runs.
      let result!: T;
      db.withTransactionSync(() => {
        result = fn();
      });
      return result;
    },
  };
}
