import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

const DB_NAME = "pluralscape-sync.db";

/**
 * wa-sqlite backed by Origin Private File System (OPFS).
 * Only available on web with OPFS support (Chrome 86+, Safari 16.4+, Firefox 111+).
 *
 * This is a web-only module — tree-shaken from native bundles via dynamic import
 * in detect.ts.
 *
 * Architecture note: wa-sqlite's entire JS API is async (all methods return Promise).
 * The SqliteDriver interface requires synchronous run/all/get/exec/transaction methods.
 * This driver bridges that gap by:
 *
 *   - exec() / run(): fire-and-forget via `void` — safe for DDL and write-only DML
 *   - all() / get(): use the exec row-accumulator pattern with synchronous callback —
 *     the callback is invoked per-row within the async iterator. Because
 *     OPFSCoopSyncVFS uses FileSystemSyncAccessHandle, the non-asyncify wa-sqlite
 *     build resolves each step() synchronously, making callbacks effectively sync.
 *
 * Production deployments MUST run this driver inside a dedicated Web Worker where
 * Atomics.wait is available for blocking synchronous behaviour.
 */
export async function createOpfsSqliteDriver(): Promise<SqliteDriver> {
  // Dynamic imports keep wa-sqlite out of native bundles
  const [{ default: SQLiteESMFactory }, SQLite, { OPFSCoopSyncVFS }] = await Promise.all([
    import("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs"),
    import("@journeyapps/wa-sqlite"),
    import("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js"),
  ]);

  const waModule: WaSqliteModule = await SQLiteESMFactory();
  const sqlite3 = SQLite.Factory(waModule);

  const vfs = await OPFSCoopSyncVFS.create(DB_NAME, waModule);
  sqlite3.vfs_register(vfs, true);

  const db = await sqlite3.open_v2(DB_NAME);

  function makeStatement<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
    return {
      run(...params: unknown[]): void {
        if (params.length > 0) {
          throw new Error("OPFS driver: parameterized queries not yet implemented (see ps-0azs)");
        }
        void sqlite3.exec(db, sql);
      },

      all(...params: unknown[]): TRow[] {
        if (params.length > 0) {
          throw new Error("OPFS driver: parameterized queries not yet implemented (see ps-0azs)");
        }
        const rows: TRow[] = [];
        // The exec callback is invoked synchronously per row in the non-asyncify
        // wa-sqlite build with OPFSCoopSyncVFS (synchronous file access handles).
        void sqlite3.exec(db, sql, (row: (WaSqliteCompatibleType | null)[], columns: string[]) => {
          const obj = Object.create(null) as Record<string, unknown>;
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            if (col !== undefined) {
              obj[col] = row[i];
            }
          }
          rows.push(obj as TRow);
        });
        return rows;
      },

      get(...params: unknown[]): TRow | undefined {
        return this.all(...params)[0];
      },
    };
  }

  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      return makeStatement<TRow>(sql);
    },

    exec(sql: string): void {
      void sqlite3.exec(db, sql);
    },

    transaction<T>(fn: () => T): T {
      void sqlite3.exec(db, "BEGIN");
      try {
        const result = fn();
        void sqlite3.exec(db, "COMMIT");
        return result;
      } catch (err) {
        void sqlite3.exec(db, "ROLLBACK");
        throw err;
      }
    },

    close(): void {
      void sqlite3.close(db);
    },
  };
}
