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
 *   - exec() / run(): store-and-check via trackExec — the Promise is cached and any
 *     rejection is surfaced on the next operation or explicit flush()
 *   - all() / get(): use the exec row-accumulator pattern with synchronous callback —
 *     the callback is invoked per-row within the async iterator. Because
 *     OPFSCoopSyncVFS uses FileSystemSyncAccessHandle, the non-asyncify wa-sqlite
 *     build resolves each step() synchronously, making callbacks effectively sync.
 *
 * Parameterized queries (run/all/get with bind params) use the wa-sqlite prepared
 * statement API: statements() -> bind_collection() -> step() -> row()/column_names().
 * These are async and follow the same store-and-check pattern as exec().
 *
 * Production deployments MUST run this driver inside a dedicated Web Worker where
 * Atomics.wait is available for blocking synchronous behaviour.
 */
export async function createOpfsSqliteDriver(): Promise<SqliteDriver & { flush(): Promise<void> }> {
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

  let lastExecPromise: Promise<number> = Promise.resolve(0);
  let lastError: Error | null = null;

  function trackExec(
    sql: string,
    callback?: (row: (WaSqliteCompatibleType | null)[], columns: string[]) => void,
  ): void {
    checkLastError();
    const promise = callback ? sqlite3.exec(db, sql, callback) : sqlite3.exec(db, sql);
    lastExecPromise = promise;
    promise.catch((err: unknown) => {
      lastError = err instanceof Error ? err : new Error(String(err));
    });
  }

  /**
   * Execute a parameterized query using wa-sqlite's prepared statement API.
   * Returns collected rows as column-name-keyed objects (empty array for non-SELECT).
   *
   * Lifecycle: statements() -> bind_collection() -> step() loop -> row()/column_names()
   * The async iterator from statements() auto-finalizes when iteration completes.
   */
  function trackPrepared(
    sql: string,
    params: ReadonlyArray<WaSqliteCompatibleType | null>,
    rows: Record<string, unknown>[],
  ): void {
    checkLastError();

    const promise = (async () => {
      for await (const stmt of sqlite3.statements(db, sql)) {
        sqlite3.bind_collection(stmt, params);

        const columns = sqlite3.column_names(stmt);
        while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const values = sqlite3.row(stmt);
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            if (col !== undefined) {
              obj[col] = values[i];
            }
          }
          rows.push(obj);
        }
      }
      return 0;
    })();

    lastExecPromise = promise;
    promise.catch((err: unknown) => {
      lastError = err instanceof Error ? err : new Error(String(err));
    });
  }

  function checkLastError(): void {
    if (lastError !== null) {
      const err = lastError;
      lastError = null;
      throw err;
    }
  }

  /**
   * Cast unknown params from the SqliteStatement interface to wa-sqlite compatible
   * types. The sync adapters only pass null, number, string, and Uint8Array values.
   */
  function toBindParams(params: unknown[]): (WaSqliteCompatibleType | null)[] {
    return params.map((p) => {
      if (p === null || p === undefined) return null;
      if (typeof p === "number" || typeof p === "string" || typeof p === "bigint") return p;
      if (p instanceof Uint8Array) return p;
      if (Array.isArray(p)) return p as number[];
      // Unreachable for known callers (sync adapters only pass null/number/string/Uint8Array),
      // but handle gracefully by JSON-serializing unknown objects.
      return JSON.stringify(p);
    });
  }

  function makeStatement<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
    return {
      run(...params: unknown[]): void {
        if (params.length > 0) {
          trackPrepared(sql, toBindParams(params), []);
          return;
        }
        trackExec(sql);
      },

      all(...params: unknown[]): TRow[] {
        if (params.length > 0) {
          const rows: Record<string, unknown>[] = [];
          trackPrepared(sql, toBindParams(params), rows);
          return rows as TRow[];
        }
        const rows: TRow[] = [];
        // The exec callback is invoked synchronously per row in the non-asyncify
        // wa-sqlite build with OPFSCoopSyncVFS (synchronous file access handles).
        trackExec(sql, (row: (WaSqliteCompatibleType | null)[], columns: string[]) => {
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
      trackExec(sql);
    },

    transaction<T>(fn: () => T): T {
      trackExec("BEGIN");
      try {
        const result = fn();
        trackExec("COMMIT");
        return result;
      } catch (err: unknown) {
        trackExec("ROLLBACK");
        throw err;
      }
    },

    close(): void {
      checkLastError();
      const closePromise = sqlite3.close(db);
      lastExecPromise = closePromise;
      closePromise.catch((err: unknown) => {
        lastError = err instanceof Error ? err : new Error(String(err));
      });
    },

    async flush(): Promise<void> {
      await lastExecPromise;
      checkLastError();
    },
  };
}
